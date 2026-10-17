# 神聖アライグマ帝国［YSK］

ホワイトアウトサバイバルの同盟紹介サイトと管理画面です。前回の `feat/ysk-clan-site` を引き継いでいます。初期の文章・6人のメンバー・3件のお知らせはすべてサンプルです。

## 非公開で使う

- 確認用サイト: https://ysk-raccoon-empire.foamycat513.chatgpt.site
- 管理画面: https://ysk-raccoon-empire.foamycat513.chatgpt.site/admin.html
- サイト全体は所有者のみ。ChatGPTへのログインが必要です。URLだけを渡しても他人は閲覧できません。
- 初回は管理画面で12〜128文字のパスワードを自分で設定します。以後はそのパスワードで管理画面へログインします。
- 保存内容は端末内ではなくD1に保存されます。別端末からも同じ内容を利用できます。
- 各フォームの「保存」で紹介ページに反映します。サイト全体のアクセス範囲は変わりません。
- 管理画面にパスワード変更欄は表示しません。設置者がターミナルの `npm run password` で変更できます。変更時は既存の管理セッションを失効します。
- 同時編集で古い内容を保存した場合は拒否します。「最新の内容を読み込み直す」で再取得してください。

このブランチをmainへマージする操作、一般公開、共有範囲の変更、独自ドメイン設定は別の判断です。この実装作業では行いません。

## 機能

- 紹介: 同盟名・タグ・ゲーム名・トップ見出し・補足・紹介見出し・紹介文・3つの活動方針・募集文を編集
- メンバー: 追加・編集・削除、R5〜R1、呼び名、サブアカウント名（最大10個）、紹介文、標準動物アイコン・背景色、画像アップロード・削除
- メンバー表示: 階級順、R5〜R1の絞り込み、呼び名とサブアカウント名の検索
- お知らせ: 追加・編集・削除、日付・分類・本文・固定表示
- 公開ページ右上の「管理者の方はこちら」から管理画面へ移動
- サークル: 寝落ち部・猟友会の紹介、追加・編集・削除・表示切替、イラストの選択
- サークルの役職: 部長・顧問など自由な役職名と、担当メンバーの複数選択・兼任。寝落ち部は部長・顧問だけ初期設定し、担当者は未登録
- ギフトコード入力先の初期値: https://wos-giftcode.centurygame.com
- リンク: Discord招待とギフトコード入力先。未設定時は準備中と表示
- スマートフォン対応、キーボード操作、アニメーション停止・OSの視差効果軽減設定に対応

メンバーは最大120人、お知らせは100件、サークルは16件、1サークルの役職は20件。内容全体の保存リクエストは450KB以内です。アイコンは元画像8MB以下のPNG/JPEG/WebPをブラウザーで中央切り抜きし、256×256px・100KB以下のWebPへ圧縮します。各画像はメンバー本文とは別に保存します。本文保存後に画像が失敗した場合は、画面にその旨を表示します。

## 認証と保存の設計

| 用途 | 構成 |
| --- | --- |
| 今回の確認用サイトの閲覧制限 | Sitesの所有者限定アクセス（プラットフォームのChatGPT認証） |
| 管理操作 | 独立した管理者パスワード、サーバー側で認証・操作ごとに検証 |
| 文章・メンバー・お知らせ | Cloudflare D1のJSONレコードと更新番号 |
| アイコン | D1 BLOB、1枚100KB以下。120枚で約12MBまで |
| セッション | D1。8時間、ランダム32バイトのトークンのSHA-256のみ保存 |
| パスワード | ソルト付きPBKDF2-SHA256（100,000回）のハッシュのみ保存 |

支払い方法の登録を前提にせず、R2・Access・外部CMSは使用しません。小さな同盟サイトでは文章と縮小アイコンをD1へ保存する構成で十分運用可能です。一般的な大容量画像置き場としてD1を使う設計ではありません。

Cloudflareへ自分で設置する場合、Workers Freeは動的リクエスト100,000/日・CPU 10ms/リクエスト、D1 Freeは500MB/DB・読み取り500万行/日・書き込み10万行/日です（2026-10-15公式資料確認）。120枚すべてのアイコンと本文でも容量は約13MB以内です。実際の上限はDB索引などの使用量も含みます。無料枠を超えた場合は処理が制限されるため、ダッシュボードで使用量を確認してください。ログインの暗号処理を含め、本番のCPU使用量は自身のCloudflareアカウントで確認します。

今回の確認用サイトはSitesが提供するCloudflare実行環境です。ユーザー自身のCloudflareアカウントへの接続・リソース作成・有料プラン契約は行っていません。上の無料枠は自分のCloudflareに移す場合の目安で、Sitesの独立した利用条件を変更するものではありません。

## セキュリティ上の実装

- HttpOnly / Secure / SameSite=Strict の `__Host-` Cookie。セッショントークンをブラウザーJSに渡しません。
- 書き込みとログインは同一Originのみ。CSRF・外部サイトからの操作を拒否します。
- ログイン試行は送信元IPのハッシュごとに15分5回まで。期限切れのレート制限を掃除します。
- SQLはバインド値。文章はtextContentで描画し、HTMLとして解釈しません。
- リンクはHTTPS限定。画像はサイズ・MIME・PNG/JPEG/WebPのマジックバイトを検証。SVG/HTMLのアップロードを拒否します。
- APIはno-store、CSP・nosniff等を設定。アイコンは再検証してから表示します。
- パスワード変更・CLIリセットで既存セッションを失効。Secretの変更でも認証フィンガープリントで失効します。
- 初期設定APIは `PRIVATE_SETUP_ENABLED=true` かつプラットフォーム由来のユーザーIDがあり、パスワード未設定の場合だけ使用可能です。公開運用へ移るときはこの環境変数を削除します。Cloudflare直接設置では設定しません。
- robots/noindexは検索エンジン向け補助です。非公開の保護はSitesのアクセス制御で行います。

## 構造とデザイン変更

- `public/theme.css`: 色・書体のトークン。雰囲気変更の入口
- `public/style.css`, `public/admin.css`: レイアウト・アニメーション・管理画面
- `public/index.html`, `public/admin.html`: ページ構造
- `public/app.js`, `public/admin.js`: 表示・編集UI。外部のフォントや画像サービスに依存しません
- `public/animals.svg`: オリジナルの標準動物アイコン
- `src/worker.js`: 認証・CRUD・D1・画像API。表示コードから独立
- `src/sample.js`: 空のDBで表示するサンプル。保存済みデータは通常の再デプロイで上書きしません
- `db/schema.ts`, `drizzle/`: Sitesでのスキーマとマイグレーション
- `migrations/`: Cloudflare直接設置でのマイグレーション。既存の0001に0002を追加
- `.openai/hosting.json`, `build/`, `vite.config.ts`: Sitesのホスティング連携
- `cloudflare/wrangler.jsonc`: 自分のCloudflareへの直接設置設定

既存の `/admin.html`, `/api/public`, `/api/login`, `/api/admin/*`, `/media/:id` とデータ形式を維持しています。設定項目を追加したため、古いデータの不足項目は表示時に初期値で補います。

## 開発と検証

Node.js 22.13以降。WindowsのVSCode + WSL Ubuntuでも利用できます。

```bash
corepack enable
pnpm install --frozen-lockfile
npm test
npm run test:runtime
npm run build
```

- `npm test`: 21件。認証、CSRF、CRUD、競合、画像、レート制限、セッション、初期設定、パスワード変更、異常入力を検証
- `npm run test:runtime`: 一時workerd + 実D1 bindingでログイン・CRUD・画像BLOB往復・競合・削除・ログアウトを検証。本番DBには接続しません
- `npm run build`: Sites用Workerを構築
- `npm run dev:cloudflare`: 自分の端末で直接設置版をローカル開発（先に `npm run db:local`）

ブラウザーでの画面操作・見た目の確認は別途行ってください。自動APIテストは見た目の検証を代替しません。

## 自分のCloudflareへの移行（今回は実行しない）

以下のdeployはworkers.devへ一般公開する操作です。所有者の公開承認後に実行してください。非公開のまま直接Cloudflareへ移す場合は、別途すべてのページ・API・画像を保護する設定が必要です。管理者ログインだけでは紹介ページの閲覧を制限できません。

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create ysk-db
```

`cloudflare/wrangler.jsonc` の `REPLACE_WITH_YOUR_D1_DATABASE_ID` を作成結果のIDへ置き換え、`DB` binding名を維持します。

```bash
npm run db:remote
npm run deploy
npm run password
```

`npm run password` は非表示入力でSecretを登録し、過去に管理画面で設定したハッシュと既存セッションをクリアします。平文パスワードをチャット・Git・ファイルへ保存しません。サイト公開直後、パスワード未設定の間は管理操作を拒否します。

初期のD1は空のためサンプルが表示されます。Sitesの確認用DBと自分のCloudflare DBは別です。既に実データを入力した場合は、内容とiconsを明示的にバックアップ・移行してから切り替えます。自動では同期しません。

既存Cloudflare設置から更新する場合は先にバックアップし、`npm run db:remote` で追加マイグレーションを適用します。通常のデプロイは保存済みデータを上書きしません。

```bash
npx wrangler d1 export ysk-db --remote --config cloudflare/wrangler.jsonc --output=backup.sql
```

バックアップには認証ハッシュ・セッションを含むため、Gitへ追加せず安全に保管します。

## 公式資料

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/secrets/

## サークル紹介と役職の編集

「サークル」タブで寝落ち部・猟友会を選び、紹介文や表示設定を編集します。「役職を追加」で部長・顧問・会長などの役職名を自由に作成でき、登録済みメンバーを複数選べます。同じ人が複数役職を兼任できます。担当者が不明なら未選択のまま保存すると「担当者未登録」と表示します。メンバーを削除した場合、その人のサークル役職への紐づけも外れます。サークルを削除してもメンバー本体は削除しません。

寝落ち部・猟友会の紹介文は仮の文章です。実際の活動や役職担当者を確認して更新してください。過去の保存データにはサークルの初期値だけを補い、既存メンバー・お知らせ・紹介文は保持します。以前のデータで空欄だったギフトコードURLには、指定されたURLを補います。一度新しい形式で保存した後は、URLを空に戻すこともできます。

## Macで管理機能をローカル確認する

```bash
npm run db:local
npm run password:local
npm run dev:cloudflare
```

ローカル用パスワードは12〜128文字で2回入力します。文字は画面に表示されません。`cloudflare/.dev.vars` にハッシュだけ保存し、Gitには含めません。この操作ではローカル管理者認証とローカルセッションをリセットし、Cloudflare本番は変更しません。開発サーバーを再起動した後、`http://localhost:8787` の右上のボタンから管理画面へ進んでください。ローカルで試した編集は、本番D1には反映されません。

初期版（rootのwrangler.jsoncを使う版）から更新する場合は、サーバーをCtrl+Cで止め、手元で変更した設定を保持してから更新します。

```bash
git stash push -m "local Cloudflare settings before upgrade" -- wrangler.jsonc
git pull --ff-only
```

設定の控えは `git stash show -p` で確認できます。新しい直接設置版の設定先は `cloudflare/wrangler.jsonc` です。実際にCloudflareへ設置する際は、控えにある実際の `database_id` をそちらの `DB` bindingに設定します。古いroot設定をそのまま復元するとSites用設定と混同するため、`git stash pop` は行わずIDを転記してください。この版ではUI用のデータ形式だけを拡張しており、サークル用の追加DBマイグレーションは不要です。初期版からの更新では、前版で追加された管理者認証の0002も `npm run db:local` で適用されます。

## サークル専用ページと保存の確認

トップページの寝落ち部・猟友会カードにあるボタンから `/circle.html?id=sleep-club`、`/circle.html?id=hunting-club` へ進めます。サークル名・紹介文・役職と担当者・所属メンバーのアイコン、呼び名、サブアカウント、紹介文を表示します。登録済みの他サークルも同じページ構成で表示します。削除済み・非表示のサークルは案内だけを表示します。

管理画面の「サークル」で「所属メンバー」を選択して保存します。役職担当者も自動的に所属メンバーへ含めます。アイコンやメンバー紹介は帝国のメンバー情報と共通なので、一度変更すると両方のページに反映されます。前版のサークルに所属リストがない場合は、既知の役職担当者だけを引き継ぎ、他の所属は管理画面で選択してください。

### HTTPローカルでログインできるのに保存が401になる場合

SafariなどがHTTP localhost上のSecure Cookieを拒否すると、パスワード照合は成功してもその後の編集リクエストにセッションが付かず401になります。`npm run dev:cloudflare` だけが `LOCAL_DEV_AUTH=true` を渡し、かつHTTP・loopbackホストの場合に限定して、HttpOnly / SameSite=Strict のローカル用Cookieを使います。HTTPSやloopback以外のホストでは、従来の `__Host-ysk_session; Secure` を必ず使います。デプロイ用の設定や認証の検証処理は緩めていません。

更新後は開発サーバーを停止して `git pull --ff-only` → `npm run dev:cloudflare` で再起動し、同じ `http://localhost:8787` から再ログインしてください。パスワードの再設定やDBの作り直しは不要です。ログイン直後にもセッションを検証し、Cookieが保持できない場合は編集前に案内します。

検証は21件の自動テストに加え、workerdと実D1 bindingで、HTTPSのセッション・保存・再読込、HTTP loopbackのセッション・保存・再読込、サークル所属・画像・競合・ログアウトを確認します。Safari実機の画面操作は別途必要です。

王国・サーバーは、左上の同盟名の下に「所属王国1916」と表示します。トップとサークル専用ページのヘッダーに共通で表示し、ヒーローには追加しません。管理画面の「紹介・リンク」にある「王国名・サーバー番号」で変更できます。

## 同盟紹介の下の募集案内

「同盟について」の後、メンバー紹介の前に「同盟員募集してます！」という案内欄を表示します。管理画面の「紹介・リンク」→「同盟紹介の下に表示する募集案内」で、見出し・本文・表示／非表示を変更して保存できます。案内内のボタンから既存の参加案内・Discordリンクへ進めます。下部の既存の募集メッセージとは独立して編集できます。新しいDBマイグレーションは不要で、保存済みの紹介・メンバー・お知らせは保持します。
