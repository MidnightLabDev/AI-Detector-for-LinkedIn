AI Detector for LinkedIn® 0.1, bring your own key build

This build keeps the existing LinkedIn extraction, post and comment behavior, highlighting, caching, minimum word setting and diagnostics while adding a detector choice.

Supported providers

Zhuque AI through Tencent EdgeOne Makers
Endpoint: https://ai-gateway.edgeone.link/v1/providers/zhuque-text/classify
Zhuque output: Human, AI and Suspected AI
When Zhuque is selected, the extension sends text only when Chrome reliably identifies it as English. Unconfirmed or non-English text is skipped.

Winston AI v2
Endpoint: https://api.gowinston.ai/v2/ai-content-detection
Winston output: Human Score from 0 to 100
Displayed AI value: 100 minus Human Score
Winston does not provide a separate Suspected AI value through this endpoint.

Winston v2 API languages
English, French, Spanish, Portuguese, Dutch, German, Polish, Italian, Romanian, Indonesian, Tagalog, Russian, Bulgarian and Simplified Chinese.
Arabic is not listed as supported by the Winston v2 API.

Winston input requirements
Minimum 300 characters.
The Winston documentation warns that text under 600 characters may be unreliable.
The extension skips Winston scans below 300 characters.

Bring your own API key
Each provider has its own key. Session storage is used by default. Remember on this device stores that provider key in the browser profile local storage. Only the selected provider receives eligible LinkedIn text.

RAID Benchmark
The popup keeps a link to https://raid-bench.xyz/leaderboard as an external benchmark reference. No leaderboard position is claimed or guaranteed by this build.

Branding
LinkedIn® is a registered trademark of LinkedIn Corporation and its affiliates. This independent product is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation or its affiliates.

Changes in 0.1
* Added provider choice between Zhuque AI and Winston AI.
* Added separate bring your own API key storage for each provider.
* Added API key setup guides inside the popup.
* Added the official Winston v2 API language list.
* Added Winston input safeguards for the 300 character minimum.
* Added Winston binary Human and AI rendering while keeping Zhuque Human, AI and Suspected AI rendering.
* Removed leaderboard rank claims while keeping the RAID leaderboard link.
* Updated privacy wording for both third party providers.
