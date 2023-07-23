import { CACHED_HASH_FILENAME, staticPathDir } from "utils/constant";
import { getFile, makeDir, makeFile } from "utils/makeFs";

export const cacheHashFile = async (
  filenameHash: string,
  type: "store" | "unstore"
) => {
  await makeDir(staticPathDir);

  const cachedFile = await getFile(staticPathDir, CACHED_HASH_FILENAME).catch(
    () => "[]"
  );
  const parsedCachedData = JSON.parse(cachedFile.toString());

  let data = parsedCachedData;
  if (type === "store") {
    data = JSON.stringify([...parsedCachedData, filenameHash]);
  } else if (type === "unstore") {
    data = JSON.stringify(
      parsedCachedData?.filter((hash: string) => hash !== filenameHash)
    );
  }

  await makeFile(staticPathDir, CACHED_HASH_FILENAME, data);
};
