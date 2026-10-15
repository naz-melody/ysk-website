# 神聖アライグマ帝国［YSK］

ホワイトアウトサバイバルの同盟紹介サイト。オリジナルSVGの動物、雪景色、アニメーション、スマートフォン対応の公開ページと、パスワードで保護した編集APIを備えた管理画面です。

## できること

- 同盟名・タグ・ゲーム名・見出し・紹介文・募集文の編集
- メンバーの追加・変更・削除、R5〜R1の階級設定、サブアカウントの複数登録
- アイコン画像のアップロード・差し替え・削除（ブラウザーで256pxの正方形に中央切り抜き、最大100KB）
- お知らせの追加・変更・削除、日付・分類・上部固定
- Discord・ギフトコード入力先の設定。未設定時は「準備中」表示
- サンプル情報の表示切替、アニメーション停止、OSの「視差効果を減らす」への対応

**初期内容はすべてサンプルです。実際のメンバー・方針・活動実績ではありません。** 初回は6人の動物アイコン付きメンバーと3件のお知らせを表示します。管理画面で保存するまでは初期内容を表示し、保存後はD1の内容を使用します。

## 使用サービス

自分のCloudflareアカウントの **Workers Free + D1** のみを使用します。R2、Access、外部CMS、外部の画像・フォントサービスは使用しません。有料プランへの変更や支払い方法の登録を行う手順はありません。Cloudflare側で有料契約を選択しないでください。無料枠の範囲や制限は公式ドキュメントをご確認ください。

このコードをGitHubへ保存するだけでは公開されません。Cloudflareへの初回設置が必要です。GitHub Pagesだけではログイン・D1保存は動きません。

## 初回設置（Mac / Windows / Linux）

Node.js 22以降とGitをインストールした端末で、ターミナルを開きます。WindowsではVSCodeの「ターミナル」から「新しいターミナル」を開き、右上の▼から「Command Prompt（コマンドプロンプト）」を選ぶと、以下をそのまま実行できます。

### 1. コード取得とCloudflareログイン

```bash
git clone https://github.com/naz-melody/ysk-website.git
cd ysk-website
npm install
npx wrangler login
npx wrangler whoami
```

CloudflareはWorkersの無料プランを使用します。ログインは自分のブラウザーで行ってください。認証情報をチャットやリポジトリへ貼り付ける必要はありません。

ブラウザーが開いたら、今回使うCloudflareアカウントで許可してください。別アカウントなら、ブラウザーのCloudflareからログアウトして正しいアカウントへ切り替え、ターミナルで `npx wrangler logout` → `npx wrangler login` → `npx wrangler whoami` の順に確認します。GitHubとCloudflareのログインは独立しており、今回のターミナル公開ではCloudflareのGitHubアプリ再インストールは不要です。GitHub連携による自動公開は別途任意で設定できます。

### 2. データベースを作成

```bash
npx wrangler d1 create ysk-db
```

出力に表示される `database_id` をコピーし、`wrangler.jsonc` の `REPLACE_WITH_YOUR_D1_DATABASE_ID` を置き換えます。`DB` というbinding名は変更しません。データベースを既に作った場合は `npx wrangler d1 list` でIDを確認できます。

```bash
npm run db:remote
```

### 3. 公開してパスワードを設定

```bash
npm run deploy
npm run password
```

`npm run password` は入力内容を表示せず、ソルト付きPBKDF2ハッシュをWrangler経由でCloudflare Secretへ登録します。パスワード自体はファイルにもGitHubにも保存しません。12文字以上の推測しづらいパスワードを設定します。秘密情報をチャットに送る必要はありません。パスワード未設定の間はログインできません。

`npm run deploy` の結果に表示される `https://ysk-website.<あなたのサブドメイン>.workers.dev` が公開URLです。管理画面はそのURLの `/admin.html` にあります。実際のURLはCloudflareの出力で確認してください。

### 4. 管理画面から編集

1. 管理者パスワードでログイン。
2. 「紹介・リンク」で文章、Discord、正しいギフトコード入力先を登録して保存。
3. 「メンバー」でサンプルを変更・削除し、実際のメンバーを追加。
4. 「お知らせ」で仮のお知らせを入れ替え。
5. 実際の情報へ置き換えたら「サンプル情報である旨を表示する」を外して保存。

メンバーは最大120人、各サブアカウント10個、お知らせ100件です。標準動物アイコンも自由に選べます。アイコン画像はD1へ保存します。元の画像は8MB以下、出力は100KB以下です。画像はメンバー本文の保存後にアップロードします。画像のアップロードが失敗した場合は、その旨を画面に表示するので画像を選び直してください。

## 手元での開発

```bash
npm run db:local
npm run dev
```

公開ページの表示にはローカルD1を使用します。ローカルで管理機能を検証する場合は `.dev.vars` に `ADMIN_PASSWORD_HASH` を設定してください（このファイルはGit管理対象外）。ハッシュは `pbkdf2$<16バイトのソルトの16進数32文字>$<PBKDF2-SHA256・100000回・32バイト出力の16進数64文字>` の形式です。Cookieは常にSecureなのでローカルのHTTPS設定またはlocalhostを使用してください。

```bash
npm test
```

Node.jsのSQLiteでD1互換ラッパーを使い、ログイン・CSRF・CRUD・競合更新・画像形式とサイズ・レート制限・ログアウトを検証します。Cloudflare実環境とブラウザー上の最終確認は設置後に行ってください。

更新を取得して再公開する場合：

```bash
git pull
npm install
npm run deploy
```

DBの内容は通常のコード再公開では上書きしません。変更前のバックアップは `npx wrangler d1 export ysk-db --remote --output=backup.sql` で取得できます。バックアップには管理用データも含まれるのでGitへ追加せず、自分の端末で保管してください。

## 認証・運用

- 認証はサーバー側。未認証の編集APIは401を返します。
- セッションは8時間、CookieはHttpOnly / Secure / SameSite=Strict。サーバーにはトークンのSHA-256だけを保存。
- 更新・ログインAPIは同一Originを必須にし、他サイトからの書き込みを拒否。
- ログイン試行は送信元IPのハッシュごとに15分あたり5回まで。判定はD1で共有。
- SQLはバインド値、文章の描画はtextContentを使用。SVGやHTMLのアップロードは受け付けません。
- 同時編集は更新番号で検出し、古い内容による上書きを拒否します。
- ログイン画面のHTMLは公開ですが、内容の変更・アップロードにはログインが必要です。
- パスワード変更は `npm run password`。既存セッションをすべて失効する場合は下記も実行。

```bash
npx wrangler d1 execute ysk-db --remote --command="DELETE FROM sessions"
```

## ファイル構成

- `public/`: 公開ページ、管理画面、オリジナル動物SVG、CSS、ブラウザーJS
- `src/worker.js`: API、認証、D1・画像処理
- `src/sample.js`: 初期サンプルデータ
- `migrations/`: DB初期設定
- `scripts/set-password.mjs`: 非表示入力でのパスワード設定
- `test/`: 認証・永続化の回帰テスト

## 公式資料

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/secrets/

ゲーム公式素材やロゴは同梱していません。動物はこのサイト用のSVGです。ゲーム運営会社と関係のない非公式サイトであることを表示しています。
