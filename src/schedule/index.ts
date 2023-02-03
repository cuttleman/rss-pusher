import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { uniqBy } from "lodash-es";
import { scheduleJob } from "node-schedule";

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

const xml2json = new XMLParser();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const _rawUnduplicated = (
  items: IRssResponseItem[],
  exceptionRegex: RegExp
) => {
  const copiedItems = [...items];
  for (let i = 0; i < copiedItems.length; i++) {
    for (let j = copiedItems.length - 1; j >= 0; j--) {
      if (i === j || !copiedItems[i] || !copiedItems[j]) continue;

      const testText = copiedItems[i].title
        .replace(exceptionRegex, "")
        .split(" ")
        .filter((_t) => !!_t);
      const controlText = copiedItems[j].title
        .replace(exceptionRegex, "")
        .split(" ")
        .filter((_t) => !!_t);

      const sameText = [];
      for (let k = 0; k < testText.length; k++) {
        for (let m = 0; m < controlText.length; m++) {
          if (
            testText[k].length > controlText[m].length &&
            testText[k].includes(controlText[m])
          ) {
            sameText.push(testText[k]);
          } else if (controlText[m].includes(testText[k])) {
            sameText.push(controlText[m]);
          }
        }
      }

      if (Number((sameText.length / testText.length).toFixed(2)) < 0.5)
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
  storedWebhook: any,
  storedTitles: string[]
) => {
  const newFeeds = [];

  for (const subscription of storedWebhook.subscriptions) {
    const { data } = await axios.get(subscription.url);
    const parseData = xml2json.parse(data) as IRssResponse;

    const keyword = subscription.keyword ?? "";
    const items = parseData?.rss?.channel?.item;
    if (Array.isArray(items)) {
      // 제목에서 출판사 제거
      const removeSourceItems = items.map((item) => ({
        ...item,
        title: _removeSource(item.title, item.source),
      }));

      // 저장되어있던 제목들과 중복체크
      const duplicatedCheckByNewFeed = removeSourceItems.filter(
        (feed) => !storedTitles?.includes(feed.title)
      );

      // 텍스트별 중복체크 - 50% 이상 일치시 중복으로 간주
      newFeeds.push(
        ..._rawUnduplicated(duplicatedCheckByNewFeed, /[.|,\\\-:'"‘’·]/g)
          .slice(0, subscription.max ?? Infinity)
          .map((item) => ({ ...item, keyword }))
      );
    } else if (items) {
      const removeSourceItem = {
        ...items,
        title: _removeSource(items.title, items.source),
      };
      storedTitles?.includes(removeSourceItem.title) &&
        newFeeds.push({ ...removeSourceItem, keyword });
    }

    await sleep(5000);
  }

  // 1. 텍스트별 중복체크 - 50% 이상 일치시 중복으로 간주
  // 2. 타이틀 기준으로 중복 체크
  return uniqBy(
    _rawUnduplicated(newFeeds, /[.|,\\\-:'"‘’·]/g),
    "title"
  ) as IRssResponseItemWithKeyword[];
};

const _scanRssWebhook = async (): Promise<any[]> => {
  return [];
};

const _scanRssFeed = async (): Promise<any[]> => {
  return [];
};

const _batchPutRSSFeed = async (
  id: string,
  newFeeds: IRssResponseItemWithKeyword[]
) => {
  return;
};

const rssSchedule = async () => {
  try {
    // rss-webhook 테이블 조회
    const storedWebhooks = await _scanRssWebhook();
    // rss-feed 테이블 조회
    const storedFeeds = await _scanRssFeed();

    // webhookUrl(채널) 기준으로 반복
    for (const storedWebhook of storedWebhooks) {
      // 활성화 체크
      if (!storedWebhook.active) continue;

      // 저장된 피드데이터
      const storedFeedTilesById = storedFeeds
        ?.filter((feed) => feed?.id === storedWebhook?.id)
        .map((feed) => feed.title);

      // 갱신된 피드데이터중 저장된 피드데이터와 중복체크 -> 중복제거된 피드데이터 반환
      const unduplicatedFeeds = await _removeRedundantFeeds(
        storedWebhook,
        storedFeedTilesById || []
      );

      if (!unduplicatedFeeds.length) continue;

      // rss-webhook 테이블 데이터 갱신
      await _batchPutRSSFeed(storedWebhook.id, unduplicatedFeeds);
      console.log(
        `[RSS#Log] ${storedWebhook.targetChannel} 채널: ${unduplicatedFeeds.length}개 피드 추가 성공`
      );

      // 중복제거된 피드데이터 채널에 전송
      await Promise.allSettled(
        unduplicatedFeeds.map((feed) => {
          return axios.post(
            storedWebhook.webhookUrl,
            {
              text: `${feed.title}\n#${feed.keyword}${
                feed.source ? ` @${feed.source}` : ""
              }\n-----------------------------------\n${feed.link}`,
            },
            { headers: { "Content-Type": "application/json" } }
          );
        })
      );
    }
  } catch (error: any) {
    console.log("[RSS#Error]", error);
  }
};

const scheduler = () => {
  console.log("scheduler start");
  // Initial Call
  rssSchedule();
  // Call every 10 minutes
  scheduleJob("*/10 * * * *", () => {
    rssSchedule();
  });
};

scheduler();
