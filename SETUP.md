# デプロイチェックリスト

ローカル開発は完了しています。あとはあなたのアカウントで以下を順に実行してください。
所要時間: **合計 30〜45 分**。

---

## 0. すでに完了していること (こちらでやりました)

- [x] ファイル一式の作成 (HTML / CSS / JS / Worker / Service Worker / Python スクリプト / 各データ JSON / アバター SVG / 設定ファイル一式)
- [x] `git init` 初期化済み (まだ commit はしていません — 下の手順 1 で commit します)
- [x] Worker 用 npm deps インストール済み (`worker/node_modules/`)
- [x] **VAPID 鍵 1 セット生成済み**
  - 公開鍵 → `data/config.json` の `vapidPublicKey` にセット済み
  - 秘密鍵 → ⬇️下記
- [x] Web Push, Service Worker, PWA manifest 構成済み
- [x] パスコードゲート (`duffy` / `ezolympic` / `2411`)
- [x] 全動画プレイヤー実装 (PCモーダル + モバイルインライン)

### 🔑 VAPID 秘密鍵

ローカルディスクの `.local-secrets.txt` に書き出してあります (gitignore 済 = 永久にコミットされません)。
以下で確認できます:

```bash
cat .local-secrets.txt
```

後ほど `wrangler secret put VAPID_PRIVATE_KEY` で Worker に投入します。
**このファイルは決して GitHub に push しないでください**。万一の対策として `.gitignore` で `.local-secrets.*` 全部を除外済み。

---

## 1. GitHub リポジトリ作成 + Push

```bash
cd ~/Desktop/AI/friend-likes

# 初回コミット
git add .
git commit -m "feat: initial release"

# GitHub に空のリポジトリを作成 (https://github.com/new)
# 名前は何でも OK (例: friend-likes / minna-no-douga など)
# Description: お好みで
# Visibility: Public でも Private でもOK (Public のほうが GitHub Pages が無料で使える)

# リモート登録 + push
git remote add origin https://github.com/<your-handle>/<repo-name>.git
git push -u origin main
```

---

## 2. Google Cloud OAuth 設定

[https://console.cloud.google.com/](https://console.cloud.google.com/)

- [ ] 新規プロジェクト作成 (例: `friend-likes`)
- [ ] **YouTube Data API v3** を有効化 (APIs & Services → Library)
- [ ] **OAuth consent screen** を設定:
   - User type: **External**
   - App name / support email / developer contact: 自分の情報
   - Scopes に追加: `https://www.googleapis.com/auth/youtube.readonly`
   - Test users に **参加してもらう友人の Google アカウント emails 全員 + 自分** を登録
   - Publishing status: **Testing のまま** (Production は審査必要なので今は不要)
- [ ] **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: あとで Worker をデプロイしてから登録 (空でも一旦OK)
   - 発行後、**Client ID** と **Client Secret** を控える

---

## 3. GitHub Fine-grained PAT 作成

[https://github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)

- [ ] "Generate new token (fine-grained)"
- Resource owner: あなた
- Repository access: **Only select repositories** → さきほど作ったリポジトリ
- Repository permissions:
  - **Actions: Read and write**
  - **Secrets: Read and write**
  - **Contents: Read and write**
- Expiration: 1 year (最長)
- 発行後 `github_pat_xxxxx` を控える

---

## 4. Cloudflare Worker デプロイ

```bash
cd ~/Desktop/AI/friend-likes/worker
npx wrangler login    # ブラウザで Cloudflare にログイン (無料アカウントでOK)
```

### 4.1 設定編集

`worker/wrangler.toml` を編集:

```toml
[vars]
GITHUB_REPO     = "<your-handle>/<repo-name>"           # 例: rikimaru/friend-likes
GITHUB_BRANCH   = "main"
GITHUB_WORKFLOW = "update.yml"
SITE_ORIGIN     = "https://<your-handle>.github.io/<repo-name>"
WORKER_ORIGIN   = "https://friend-likes-renew.<your-cf-subdomain>.workers.dev"  # 暫定 (後で確定値で再 deploy)
VAPID_SUBJECT   = "mailto:あなたのメールアドレス"

USER_EMAIL_MAP = """
{
  "your-email@gmail.com": "you",
  "friend1@gmail.com": "friend1"
}
"""

USERS_JSON = """
[
  { "id": "you", "name": "自分" },
  { "id": "friend1", "name": "友達1" }
}
"""
```

### 4.2 初回 deploy (URL 確定のため)

```bash
npx wrangler deploy
```

→ 出力された URL (例: `https://friend-likes-renew.rikimaru.workers.dev`) を控える。

### 4.3 設定値を最終確定

`worker/wrangler.toml` の `WORKER_ORIGIN` を実際の URL に書き換え。
`data/config.json` の `workerOrigin` も同じ URL に書き換え。

```bash
npx wrangler deploy   # 再 deploy で WORKER_ORIGIN 反映
```

### 4.4 Worker secrets 設定

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
# プロンプト → Google で取得した Client ID を貼り付け

npx wrangler secret put GOOGLE_CLIENT_SECRET
# プロンプト → Google で取得した Client Secret を貼り付け

npx wrangler secret put GITHUB_TOKEN
# プロンプト → GitHub PAT (github_pat_xxx) を貼り付け

npx wrangler secret put COOKIE_SECRET
# プロンプト → openssl rand -hex 32 で生成したランダム文字列を貼り付け

npx wrangler secret put VAPID_PUBLIC_KEY
# 値は .local-secrets.txt (またはすでに data/config.json) を参照

npx wrangler secret put VAPID_PRIVATE_KEY
# 値は .local-secrets.txt を参照
```

### 4.5 Google OAuth に redirect URI 登録

Google Cloud Credentials → 作った Web client → Authorized redirect URIs に
`https://friend-likes-renew.<your-cf-subdomain>.workers.dev/callback`
を追加して Save。

---

## 5. GitHub Pages 公開

リポジトリ → Settings → Pages

- Source: **Deploy from a branch**
- Branch: **main**, folder: **/ (root)**
- Save

→ 1-2 分で `https://<your-handle>.github.io/<repo-name>/` でアクセス可能に。

---

## 6. GitHub Secrets 登録 (毎日の自動取得用)

リポジトリ → Settings → Secrets and variables → Actions → New repository secret

- [ ] `GOOGLE_CLIENT_ID` (Worker と同じ)
- [ ] `GOOGLE_CLIENT_SECRET` (Worker と同じ)

`USER_<ID>_REFRESH_TOKEN` 系は **不要**。Worker が初回サインイン時に自動で登録します。

---

## 7. Workflow 編集 + 動作確認

`.github/workflows/update.yml` の env block — 各ユーザー分の行が必要:

```yaml
env:
  GOOGLE_CLIENT_ID:     ${{ secrets.GOOGLE_CLIENT_ID }}
  GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
  USER_YOU_REFRESH_TOKEN:     ${{ secrets.USER_YOU_REFRESH_TOKEN }}
  USER_FRIEND1_REFRESH_TOKEN: ${{ secrets.USER_FRIEND1_REFRESH_TOKEN }}
```

`data/users.json` も実メンバーに合わせて編集。
全部 commit & push:

```bash
git add data/users.json data/config.json .github/workflows/update.yml worker/wrangler.toml
git commit -m "config: production setup"
git push
```

---

## 8. 自分でサインイン (動作確認)

1. デプロイ済みの GitHub Pages URL を開く
2. 合言葉 (`duffy` / `ezolympic` / `2411` のどれか) を入力
3. **Continue with Google** → 自分の Google アカウントでサインイン → 同意画面で許可
4. プライバシー選択 (オープン / 匿名)
5. アバター選択
6. 自分のアカウントが Worker secrets に `USER_YOU_REFRESH_TOKEN` として自動登録される
7. リポジトリの **Actions** タブから "Update liked videos" を **手動実行** → 数秒で `data/videos.json` が更新される

---

## 9. 友人を招待

各友人に:
1. 上記の URL
2. 合言葉

を Signal / LINE などで共有。各自がサインインすると Worker が自動で:
- USER_<ID>_REFRESH_TOKEN を repo secrets に追加
- data/users.json と data/status.json をコミット
- Workflow を発火

ただし `.github/workflows/update.yml` の env block は手動で1行追加 (各 USER_<ID>_REFRESH_TOKEN を ${{ secrets... }} で参照する行) する必要があります。

---

## 10. 問題が起きたら

| 症状 | 確認すること |
|---|---|
| 合言葉ゲートを通れない | LocalStorage がブロックされていないか (シークレットモードだと毎回必要) |
| Google サインインで「未認証」 | Google Cloud の Test users にメールが追加されているか |
| Worker 側で 401 連発 | wrangler secret 値が一文字でもズレてないか (改行混入注意) |
| Action が PR を pus できない | GitHub Token の Contents: write 権限を確認 |
| アクセスが 7 日で切れた | これは Google Testing-mode の仕様。再サインインで復活 |

---

## おわりに

このサイトは「設置すれば自動で運用できる」ように極力少ない手数になっています。
何か行き詰まったら聞いてください — wrangler 出力やブラウザコンソールのスクリーンショットがあると診断が速いです。
