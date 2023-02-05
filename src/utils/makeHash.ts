import { createHash } from "crypto";

const makeHash = (target: string) => {
  return createHash("sha256").update(target).digest("hex");
};

export default makeHash;
