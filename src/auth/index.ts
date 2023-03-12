import axios from "axios";
import crypto from "crypto";
import { Router } from "express";
import { constants } from "http2";

interface ITokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}

const router = Router();

const tokenInfo = {} as ITokenResponse;

router.get("/", async (req, res) => {
  res.redirect(
    `https://openapi.swit.io/oauth/authorize?client_id=xulLnnnhjStQzZwUqdxYvk60qBhKSUXa&redirect_uri=https://rss-pusher.fly.dev/oauth/callback&response_type=code&state=${crypto.randomUUID()}&scope=app:install`
  );
});

router.get("/callback", async (req, res) => {
  try {
    const result = await axios.post<ITokenResponse>(
      "https://openapi.swit.io/oauth/token",
      {
        grant_type: "authorization_code",
        client_id: "xulLnnnhjStQzZwUqdxYvk60qBhKSUXa",
        client_secret: "iAmNGT56yoRCCUgOSheD3K88",
        redirect_uri: "https://rss-pusher.fly.dev/oauth/callback",
        code: req.query.code,
      },
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in, scope, token_type } =
      result.data;

    tokenInfo.access_token = access_token;
    tokenInfo.refresh_token = refresh_token;
    tokenInfo.expires_in = expires_in;
    tokenInfo.scope = scope;
    tokenInfo.token_type = token_type;

    res.status(200).json(result.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.status === 401) {
        const result = await axios.post<ITokenResponse>(
          "https://openapi.swit.io/oauth/token",
          {
            grant_type: "refresh_token",
            client_id: "xulLnnnhjStQzZwUqdxYvk60qBhKSUXa",
            client_secret: "iAmNGT56yoRCCUgOSheD3K88",
            refresh_token: tokenInfo.refresh_token,
          },
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token, refresh_token } = result.data;

        tokenInfo.access_token = access_token;
        tokenInfo.refresh_token = refresh_token;

        res.status(200).json(result.data);
      }
    }
  }
});

export default router;
