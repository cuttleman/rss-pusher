import axios, { AxiosError } from "axios";
import { XMLParser } from "fast-xml-parser";
import { PathLike } from "fs";
import uniqBy from "lodash/unionBy";

import {
  delayTimeMs,
  feedPathDir,
  scrapFeedConfig,
  storedFeedTTL,
  webhookPathDir,
} from "utils/constant";
import { getDir, getFile, makeDir, makeFile } from "utils/makeFs";
import sleep from "utils/sleep";

interface IRssResponseItem {
  title: string;
  link: string;
  pubDate: string;
  source?: string;
}

interface IRssResponse {
  rss: {
    channel: {
      title: string;
      link: string;
      language: string;
      copyright: string;
      description: string;
      item: IRssResponseItem | IRssResponseItem[];
    };
  };
}

interface IRssResponseItemWithKeyword extends IRssResponseItem {
  keyword: string;
}

interface IStoredWebhookData {
  id: string;
  webhookurl: string;
  keywords: string[];
}

interface IStoredFeedData {
  id: string;
  feeds: { title: string; keyword: string; ttl: number }[];
}

const xml2json = new XMLParser();

const _rawUnduplicated = (
  items: IRssResponseItem[],
  exceptionRegex: RegExp
) => {
  const copiedItems = [...items];
  for (let i = 0; i < copiedItems.length; i++) {
    for (let j = copiedItems.length - 1; j >= 0; j--) {
      if (i === j || !copiedItems[i]?.title || !copiedItems[j]?.title) continue;

      const itemA = copiedItems[i].title
        .toLowerCase()
        .replace(exceptionRegex, "")
        .split(" ");
      const itemB = copiedItems[j].title
        .toLowerCase()
        .replace(exceptionRegex, "")
        .split(" ");

      const joinItemA = itemA.join("");
      const joinItemB = itemB.join("");

      const sameA = itemA.filter(
        (text) => text.length > 0 && joinItemB.includes(text)
      );
      const sameB = itemB.filter(
        (text) => text.length > 0 && joinItemA.includes(text)
      );

      let sameArr = sameA;
      let originArr = itemA;
      if (sameA.length < sameB.length) {
        sameArr = sameB;
        originArr = itemB;
      }

      if (Number((sameArr.length / originArr.length).toFixed(2)) < 0.5)
        continue;
      copiedItems.splice(j, 1, null);
    }
  }
  return copiedItems.filter((text) => !!text);
};

const _removeSource = (title: string, source?: string) => {
  // for Google News
  return title.replace(` - ${source}`, "");
};

const _removeBreadcrumb = (title: string) => {
  return title.replace(/\s?<\s?[\w가-힣]*\s?/g, "");
};

const _removeRedundantFeeds = async (
  storedWebhook: IStoredWebhookData,
  storedTitles: string[]
) => {
  const newFeeds = [];

  for (const storedKeyword of storedWebhook.keywords) {
    const [key, lang = "ko"] = storedKeyword.split("@"); // key@lang
    const { data } = await axios.get(
      `https://news.google.com/rss/search?q=${key ? `"${key}" ` : ""}when:${
        scrapFeedConfig.when
      }&hl=${lang}`
    );

    const parseData = xml2json.parse(data) as IRssResponse;

    const keyword = key ?? "";
    const items = parseData?.rss?.channel?.item;

    if (Array.isArray(items)) {
      // 제목에서 출판사 제거
      const removeSourceItems = items.map((item) => ({
        ...item,
        title: _removeBreadcrumb(_removeSource(item.title, item.source)),
      }));

      // 저장되어있던 제목들과 중복체크
      const duplicatedCheckByNewFeed = removeSourceItems.filter(
        (feed) => !storedTitles?.includes(feed.title)
      );

      // 텍스트별 중복체크 - 50% 이상 일치시 중복으로 간주
      newFeeds.push(
        ..._rawUnduplicated(duplicatedCheckByNewFeed, /[.|,\\\-:'"‘’·]/g)
          .slice(0, scrapFeedConfig.limit)
          .map((item) => ({ ...item, keyword }))
      );
    } else if (items) {
      items.title = _removeBreadcrumb(_removeSource(items.title, items.source));

      if (storedTitles?.includes(items.title)) continue;
      newFeeds.push({ ...items, keyword });
    }

    await sleep(delayTimeMs.scrap);
  }

  return uniqBy(
    _rawUnduplicated(newFeeds, /[.|,\\\-:'"‘’·]/g),
    "title"
  ) as IRssResponseItemWithKeyword[];
};

const _scanStoredData = async (dirPath: PathLike) => {
  await makeDir(dirPath);
  const files = await getDir(dirPath);

  const data = [];
  for (const filename of files) {
    const buffer = await getFile(dirPath, filename);
    const parsedBuffer = JSON.parse(buffer.toString());
    data.push(parsedBuffer);
  }

  return data as IStoredWebhookData[] | IStoredFeedData[];
};

const _batchPutRSSFeed = async (
  id: string,
  storedFeeds: IStoredFeedData,
  newFeeds: IRssResponseItemWithKeyword[]
) => {
  const data = {
    id,
    feeds: [
      ...(storedFeeds?.feeds || []),
      ...newFeeds.map((feed) => ({
        title: feed.title,
        keyword: feed.keyword,
        ttl: Date.now() + storedFeedTTL,
      })),
    ],
  };
  makeFile(feedPathDir, `${id}.json`, JSON.stringify(data));
  return;
};

const _ttlCheckRSSFeed = async (matchedFeed: IStoredFeedData, id: string) => {
  if (!matchedFeed) return;

  const ttlCheckedFeeds = matchedFeed.feeds.filter(
    (feed) => feed.ttl > Date.now()
  );
  await makeFile(
    feedPathDir,
    `${id}.json`,
    JSON.stringify({ id, feeds: ttlCheckedFeeds })
  );
};

const _getStoredParsedFeeds = async (
  dirPath: PathLike,
  id: string
): Promise<IStoredFeedData | null> => {
  try {
    const updatedBuffer = await getFile(dirPath, id);

    return JSON.parse(updatedBuffer.toString()) as IStoredFeedData;
  } catch (error) {
    return null;
  }
};

const _getRealLink = async (link: string) => {
  try {
    const { data } = await axios.get(link);

    const match = String(data).match(/<a[^>]*>(.*?)<\/a>/);

    if (!match?.[1]) return link;
    return match[1];
  } catch (error) {
    return link;
  }
};

export const rssSchedule = async () => {
  try {
    // rss-webhook 테이블 조회
    const storedWebhooks = (await _scanStoredData(
      webhookPathDir
    )) as IStoredWebhookData[];
    // rss-feed 테이블 조회
    const storedFeeds = (await _scanStoredData(
      feedPathDir
    )) as IStoredFeedData[];

    // webhookUrl(채널) 기준으로 반복
    for (const storedWebhook of storedWebhooks) {
      let sendedCount = 0;

      const matchedFeed = storedFeeds?.find(
        (feed) => feed.id === storedWebhook.id
      );

      await _ttlCheckRSSFeed(matchedFeed, storedWebhook.id);

      // 저장된 피드데이터
      const storedParsedFeeds = await _getStoredParsedFeeds(
        feedPathDir,
        `${storedWebhook.id}.json`
      );

      // 갱신된 피드데이터중 저장된 피드데이터와 중복체크 -> 중복제거된 피드데이터 반환
      const unduplicatedFeeds = await _removeRedundantFeeds(
        storedWebhook,
        storedParsedFeeds?.feeds?.map((feed) => feed?.title) || []
      );

      if (unduplicatedFeeds.length > 0) {
        // rss-webhook 테이블 데이터 갱신
        await _batchPutRSSFeed(
          storedWebhook.id,
          storedParsedFeeds,
          unduplicatedFeeds
        );

        // 중복제거된 피드데이터 채널에 전송
        while (unduplicatedFeeds.length) {
          const feed = unduplicatedFeeds.splice(0, 1)[0];
          const realLink = await _getRealLink(feed.link);

          await axios.post(
            storedWebhook.webhookurl,
            {
              text: `<${realLink}|*${feed.title}*>\n${
                feed.keyword ? `📍${feed.keyword}  ` : ""
              }${feed.source ? `🗞️ ${feed.source}` : ""}`,
            },
            { headers: { "Content-Type": "application/json" } }
          );

          await sleep(delayTimeMs.send);

          sendedCount++;
        }
      }

      if (sendedCount > 0) {
        console.log(
          `[RSS#Log] ${storedWebhook.webhookurl} - ${storedWebhook.keywords} 채널 피드 추가 완료`
        );
      }
    }
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message: string }>(error)) {
      console.log(
        "[RSS#AxiosError]",
        error.response.status,
        error.response?.data.message
      );
    } else if (error instanceof Error) {
      console.log("[RSS#Error]", error.message);
    } else {
      console.log("[RSS#UnkownError]", error);
    }
  }
};
