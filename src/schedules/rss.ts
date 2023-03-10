import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { PathLike } from "fs";
import uniqBy from "lodash/unionBy";

import { feedPathDir, webhookPathDir } from "utils/constant";
import { getDir, getFile, makeDir, makeFile } from "utils/makeFs";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const _removeRedundantFeeds = async (
  storedWebhook: IStoredWebhookData,
  storedTitles: string[]
) => {
  const newFeeds = [];

  for (const storedKeyword of storedWebhook.keywords) {
    const [key, lang, when, site, limit] = storedKeyword.split("@"); // key@lang@when@site@limit
    const { data } = await axios.get(
      `https://news.google.com/rss/search?q=${key ? `"${key}" ` : ""}${
        site ? `site:${site} ` : ""
      }${when ? `when:${when}` : ""}&hl=${lang || "ko"}`
    );

    const parseData = xml2json.parse(data) as IRssResponse;

    const keyword = key ?? "";
    const items = parseData?.rss?.channel?.item;

    if (Array.isArray(items)) {
      // ???????????? ????????? ??????
      const removeSourceItems = items.map((item) => ({
        ...item,
        title: _removeSource(item.title, item.source),
      }));

      // ?????????????????? ???????????? ????????????
      const duplicatedCheckByNewFeed = removeSourceItems.filter(
        (feed) => !storedTitles?.includes(feed.title)
      );

      // ???????????? ???????????? - 50% ?????? ????????? ???????????? ??????
      newFeeds.push(
        ..._rawUnduplicated(duplicatedCheckByNewFeed, /[.|,\\\-:'"????????]/g)
          .slice(0, limit ? Number(limit) : 20)
          .map((item) => ({ ...item, keyword }))
      );
    } else if (items) {
      items.title = _removeSource(items.title, items.source);

      if (storedTitles?.includes(items.title)) continue;
      newFeeds.push({ ...items, keyword });
    }

    await sleep(2000);
  }

  return uniqBy(
    _rawUnduplicated(newFeeds, /[.|,\\\-:'"????????]/g),
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
        ttl: Date.now() + 7200000,
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

export const rssSchedule = async () => {
  try {
    // rss-webhook ????????? ??????
    const storedWebhooks = (await _scanStoredData(
      webhookPathDir
    )) as IStoredWebhookData[];
    // rss-feed ????????? ??????
    const storedFeeds = (await _scanStoredData(
      feedPathDir
    )) as IStoredFeedData[];

    // webhookUrl(??????) ???????????? ??????
    for (const storedWebhook of storedWebhooks) {
      const matchedFeed = storedFeeds?.find(
        (feed) => feed.id === storedWebhook.id
      );

      await _ttlCheckRSSFeed(matchedFeed, storedWebhook.id);

      // ????????? ???????????????
      const storedParsedFeeds = await _getStoredParsedFeeds(
        feedPathDir,
        `${storedWebhook.id}.json`
      );

      // ????????? ?????????????????? ????????? ?????????????????? ???????????? -> ??????????????? ??????????????? ??????
      const unduplicatedFeeds = await _removeRedundantFeeds(
        storedWebhook,
        storedParsedFeeds?.feeds?.map((feed: any) => feed?.title) || []
      );
      // console.log("unduplicatedFeeds:", unduplicatedFeeds);

      if (unduplicatedFeeds.length > 0) {
        // rss-webhook ????????? ????????? ??????
        await _batchPutRSSFeed(
          storedWebhook.id,
          storedParsedFeeds,
          unduplicatedFeeds
        );

        // ??????????????? ??????????????? ????????? ??????
        await Promise.allSettled(
          unduplicatedFeeds.map((feed) => {
            return axios.post(
              storedWebhook.webhookurl,
              {
                text: `???? ??? ${feed.title} ???\n${
                  feed.keyword ? `#${feed.keyword} ` : ""
                }${
                  feed.source ? `@${feed.source}` : ""
                }\n-----------------------------------\n${feed.link}`,
              },
              { headers: { "Content-Type": "application/json" } }
            );
          })
        );
      }

      console.log(
        `[RSS#Log] ${storedWebhook.webhookurl} ??????: ${unduplicatedFeeds.length}??? ?????? ?????? ??????`
      );
    }
  } catch (error: any) {
    console.log("[RSS#Error]", error);
  }
};
