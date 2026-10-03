# AI Detector for LinkedIn®

<img width="1672" height="941" alt="AI Detector for LinkedIn Showcase" src="https://github.com/user-attachments/assets/3c345ecf-e49a-44ca-ae3e-f58e7eec6e54" />


A Chrome extension that analyzes visible LinkedIn® posts and comments for signs of AI generated writing.

The extension uses a bring your own API key model. You choose the detector, connect your own API key, and the extension sends eligible text only to the provider you selected.

Current version: **0.1**

## What it does

AI Detector for LinkedIn® adds a small authorship result directly beside eligible LinkedIn® posts and comments while you browse.

For posts, the extension shows the category with the highest returned score and adds a matching visual indicator.

For comments and replies, the extension shows only the category with the highest score. Zero percent results are not displayed.

The extension can analyze:

* LinkedIn® feed posts
* Expanded posts
* Comments
* Replies
* English content
* Additional languages depending on the selected provider

A configurable minimum word setting lets you ignore very short text where AI detection is less meaningful.

## Supported detectors

### Zhuque AI

Zhuque AI is accessed through Tencent EdgeOne Makers using the `@makers/zhuque-text` model.

Zhuque returns three separate categories:

* Human
* AI
* Suspected AI

This extension keeps those categories separate and displays the highest returned result.

The current build allows English and Arabic text to be sent to Zhuque AI. Tencent documents the Zhuque text endpoint and the three category response format, but its public API page does not publish a specific Arabic accuracy guarantee.

Official documentation:

https://cloud.tencent.com/document/product/1552/137539

### Winston AI

Winston AI is accessed through its v2 AI content detection API.

Winston returns a Human Score from 0 to 100. The extension displays that Human score and calculates the AI score as 100 minus the Human score.

Winston does not return a separate Suspected AI category through this endpoint.

Supported Winston AI v2 languages:

* English
* French
* Spanish
* Portuguese
* Dutch
* German
* Polish
* Italian
* Romanian
* Indonesian
* Tagalog
* Russian
* Bulgarian
* Simplified Chinese

Arabic is not listed as supported by the Winston AI v2 text API.

Winston requires at least 300 characters for a text request. Its documentation also warns that shorter samples can produce less reliable assessments, so the extension skips Winston requests below the API minimum.

Official documentation:

https://docs.gowinston.ai/api-reference/v2/ai-content-detection/post

## Bring your own API key

The extension does not provide shared detector credits.

Each user connects their own API key for either Zhuque AI or Winston AI.

Keys are stored separately for each provider.

By default, an API key is kept in the browser session. If you enable **Remember on this device**, the key is stored in local extension storage for that browser profile.

Only the currently selected detector receives eligible LinkedIn® text.

To change providers, first untick **Detector enabled**, then select the other provider.

## Getting a Zhuque AI API key

1. Open Tencent EdgeOne Makers.
2. Go to Models.
3. Open API Key.
4. Create an API key.
5. Paste the key into the extension popup.
6. Save the key.
7. Enable the detector.

Tencent EdgeOne documentation:

https://cloud.tencent.com/document/product/1552/137539

## Getting a Winston AI API key

1. Create a Winston AI developer account.
2. Open the Winston AI developer dashboard.
3. Generate an API token.
4. Paste the token into the extension popup.
5. Save the key.
6. Enable the detector.

Winston AI API documentation:

https://docs.gowinston.ai/

## Detection controls

The popup currently includes:

* Detector provider selection
* Detector enabled toggle
* Analyze posts toggle
* Analyze comments toggle
* Minimum word setting
* Provider specific API key storage
* Remember on this device option
* API key setup guidance
* RAID Benchmark reference
* Page diagnostics for comment detection

## Minimum words

Very short text can produce misleading detector results because there may not be enough writing signal to evaluate.

The extension lets you choose the minimum number of words required before text is submitted for detection.

If a post or comment is shorter than the configured threshold, it is skipped and no detector request is made.

Winston AI also has its own API requirement of at least 300 characters, which is enforced separately.

## Result display

### Zhuque AI

Possible results are:

`AI generated`

`Suspected AI`

`Human written`

The category with the highest returned proportion is displayed.

### Winston AI

Possible results are:

`AI generated`

`Human written`

The extension uses Winston AI's Human Score as the Human result and calculates the AI result as its inverse.

## Privacy

The extension does not run its own analytics or inference server.

When detection is enabled, eligible visible post or comment body text is sent directly from the extension to the selected detector.

The extension is designed not to send profile headers, profile URLs, images, private messages, connections, or LinkedIn® account details. Personal information written inside a post or comment can still be part of the submitted text.

Raw LinkedIn® text is kept only while a request is being processed. Local caches use text hashes and detector results rather than a permanent archive of post content.

Provider data handling is governed by the provider you choose.

Do not use the extension with sensitive content unless you are comfortable with the selected provider's terms and privacy practices.

## Security notes

Never publish your personal API key in the repository.

Never hard code an API key into the extension source.

If you fork this project, keep credentials out of commits, screenshots, issue reports, and test files.

The current build uses Chrome Manifest V3 and requests access only to LinkedIn®, Tencent EdgeOne, Winston AI, and Chrome storage as required by its current functionality.

## RAID Benchmark

The popup includes a link to the public RAID Benchmark leaderboard as an external reference for comparing AI text detection systems.

No leaderboard position is claimed by this project. Rankings and model versions can change, and benchmark results do not guarantee the same performance on LinkedIn® posts, comments, languages, or writing styles.

RAID leaderboard:

https://raid-bench.xyz/leaderboard

RAID project:

https://raid-bench.xyz/

## Important limitations

AI text detection is probabilistic.

A result is an estimate, not proof of authorship.

Results can be affected by:

* Very short text
* Human edited AI text
* AI edited human text
* Translation
* Paraphrasing
* Mixed human and AI authorship
* Unusual formatting
* Unsupported languages
* Changes to LinkedIn® page structure
* Changes to provider models

The extension currently analyzes text only. Images and videos are not analyzed.

## Installation for testing

1. Download or clone this repository.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Enable Developer mode.
5. Click **Load unpacked**.
6. Select the extension folder.
7. Open the extension popup.
8. Choose Zhuque AI or Winston AI.
9. Add your API key.
10. Configure the detector.
11. Open or refresh LinkedIn®.

## Project status

Version 0.1 is an experimental build intended for testing detector behavior on LinkedIn® posts and comments.

The extension interface and provider integrations may change as testing continues.

## Trademark and independence

LinkedIn® is a registered trademark of LinkedIn Corporation and its affiliates.

This project is independent and is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation, Tencent, EdgeOne, Zhuque AI, or Winston AI.

Provider names and trademarks belong to their respective owners.

## Platform notice

LinkedIn publishes rules concerning browser extensions, automated activity, scraping, and software that modifies the LinkedIn experience.

Anyone distributing or using this project should review the current LinkedIn terms and policies before use or publication.

LinkedIn help and policies:

https://www.linkedin.com/help/linkedin/

## Sources

Tencent EdgeOne Zhuque AI documentation:

https://cloud.tencent.com/document/product/1552/137539

Winston AI v2 text detection documentation:

https://docs.gowinston.ai/api-reference/v2/ai-content-detection/post

RAID Benchmark:

https://raid-bench.xyz/

Chrome extension documentation:

https://developer.chrome.com/docs/extensions/

## Author

Created by **Mayas Ötegen**

https://www.midnightlab.dev/

## License

This project is source available under the PolyForm Noncommercial License 1.0.0.

Noncommercial use, modification, and redistribution are permitted under the license terms. Commercial use is not permitted without separate written permission from the copyright holder.

See the `LICENSE` file for the full terms.

For commercial licensing inquiries, contact the project owner.
