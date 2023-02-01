import axios from "axios";
import { uniqBy } from "lodash-es";
import { XMLParser } from "fast-xml-parser";
import { scheduleJob } from "node-schedule";

interface IRssResponse {
  rss: {
    channel: {
      title: string;
      link: string;
      language: string;
      copyright: string;
      description: string;
      item: {
        title: string;
        link: string;
        pubDate: string;
      }[];
    };
  };
}

const xml2json = new XMLParser();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const _removeRedundantFeeds = async (
  storedWebhook: any,
  storedTitles: string[]
) => {
  const newFeeds = [];

  for (const subscribeUrl of storedWebhook.subscribeUrls) {
    const { data } = await axios.get(subscribeUrl);
    await sleep(5000);
    const parsedRssData = xml2json.parse(data) as IRssResponse;
    const items = parsedRssData?.rss?.channel?.item;

    if (items) {
      if (Array.isArray(items)) {
        for (const item of parsedRssData.rss.channel.item) {
          newFeeds.push(item);
        }
      } else {
        newFeeds.push(items);
      }
    }
  }

  const duplicatedCheckByNewFeed = newFeeds.filter((feed) => {
    return storedTitles
      ? storedTitles.findIndex((title) => title === feed.title) < 0
      : true;
  });

  // 타이틀 기준으로 중복 한번더 체크
  return uniqBy(duplicatedCheckByNewFeed, "title");
};

const _scanRssWebhook = async (): Promise<any[]> => {
  return [];
};

const _scanRssFeed = async (): Promise<any[]> => {
  return [];
};

const _batchPutRSSFeed = async (id: string, newTitles: string[]) => {
  // await RSSFeedModel.batchPut(newTitles.map((title) => ({ id, title })));
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
      if (!storedWebhook.active) return;

      // 저장된 피드데이터
      const storedFeedTilesById = storedFeeds
        ?.filter((feed) => feed?.id === storedWebhook?.id)
        .map((feed) => feed.title);

      // 갱신된 피드데이터중 저장된 피드데이터와 중복체크 -> 중복제거된 피드데이터 반환
      const unduplicatedFeeds = await _removeRedundantFeeds(
        storedWebhook,
        storedFeedTilesById || []
      );

      if (unduplicatedFeeds.length > 0) {
        // rss-webhook 테이블 데이터 갱신
        await _batchPutRSSFeed(
          storedWebhook.id,
          unduplicatedFeeds.map((feed) => feed.title)
        );

        // 중복제거된 피드데이터 채널에 전송
        await Promise.allSettled(
          unduplicatedFeeds.map((feed) => {
            return axios.post(
              storedWebhook.webhookUrl,
              {
                text: `${feed.title}\n---------------------------------\n${feed.link}`,
              },
              { headers: { "Content-Type": "application/json" } }
            );
          })
        );
      }
    }
  } catch (error: any) {
    console.log("#Error:", error);
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
