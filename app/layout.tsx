import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "神聖アライグマ帝国［YSK］",
  description: "ホワイトアウトサバイバル同盟 YSK の紹介サイト。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
