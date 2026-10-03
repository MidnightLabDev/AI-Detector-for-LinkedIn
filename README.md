

<div align="center">
<h1>AI Detector for LinkedIn®</h1>
  <p>Detect AI generated writing directly inside LinkedIn® posts, comments, and replies.</p>

<p><strong>Bring your own API key. Choose Zhuque AI or Winston AI.</strong></p>

<p>Version 0.1</p>
<img width="1672" height="941" alt="AI Detector for LinkedIn Showcase" src="https://github.com/user-attachments/assets/3c345ecf-e49a-44ca-ae3e-f58e7eec6e54" />




</div>

## Preview

<div align="center">

<img src="https://github.com/user-attachments/assets/1405c497-381f-4852-9440-40aadc1f578d" alt="AI Detector for LinkedIn preview" width="100%">

</div>

## About

AI Detector for LinkedIn® is a Chrome extension that analyzes eligible text while you browse LinkedIn® and displays an AI authorship estimate beside posts, comments, and replies.

The extension uses a bring your own API key model. You choose the detector you want to use and connect your own provider key.

The current release supports Zhuque AI through Tencent EdgeOne Makers and Winston AI through the Winston AI API.

AI detection is probabilistic. A result is an estimate, not proof of authorship.

## Features

1. Detects eligible LinkedIn® posts.

2. Detects comments and replies.

3. Displays the highest scoring result beside analyzed content.

4. Supports Human, AI generated, and Suspected AI results with Zhuque AI.

5. Supports Human and AI generated results with Winston AI.

6. Lets you choose the minimum number of words before analysis begins.

7. Lets you enable or disable post analysis and comment analysis separately.

8. Uses your own provider API key.

9. Stores separate keys for Zhuque AI and Winston AI.

10. Keeps provider selection locked while the detector is enabled to prevent accidental switching.

11. Includes English and Arabic controls when Zhuque AI is selected.

12. Includes direct setup guides for both API providers inside the popup.

13. Includes a link to the public RAID Benchmark leaderboard for external reference.

## Supported detectors

### Zhuque AI

Zhuque AI is accessed through Tencent EdgeOne Makers using the `@makers/zhuque-text` model.

Tencent documents three text classifications:

`Human`

`AI`

`Suspected AI`

The extension keeps these classifications separate and displays the category with the highest returned proportion.

The extension currently allows English and Arabic content to be analyzed with Zhuque AI. Tencent documents the text detection API and its classification output, but does not publish a separate Arabic accuracy guarantee on the API page.

Official documentation:

https://cloud.tencent.com/document/product/1552/137539

### Winston AI

Winston AI is accessed through the Winston AI v2 text detection API.

Winston returns a Human Score from 0 to 100. The extension uses that Human Score for the Human result and calculates the AI result as `100 minus Human Score`.

The Winston v2 API currently documents support for these languages:

English, French, Spanish, Portuguese, Dutch, German, Polish, Italian, Romanian, Indonesian, Tagalog, Russian, Bulgarian, and Simplified Chinese.

Arabic is not currently listed as supported by the Winston v2 text API.

Winston requires at least 300 characters for text analysis. Winston also warns that text under 600 characters may produce unreliable results. The extension therefore respects the Winston API minimum before submitting text.

Official documentation:

https://docs.gowinston.ai/api-reference/v2/ai-content-detection/post

## Bring your own API key

This release does not provide shared detector credits.

Each user supplies their own Zhuque AI or Winston AI key.

Only the selected detector receives eligible text.

API keys are kept in the browser session by default. If you choose **Remember on this device**, the selected provider key is stored in local extension storage for that browser profile.

To change detector provider, first untick **Detector enabled**, then choose the other provider.

## How to get a Zhuque AI API key

1. Open Tencent EdgeOne Makers.

2. Open Models.

3. Open API Key.

4. Create an API key.

5. Open the extension popup.

6. Select Zhuque AI.

7. Paste your key.

8. Save the key.

Tencent documentation:

https://cloud.tencent.com/document/product/1552/137539

## How to get a Winston AI API key

1. Create a Winston AI developer account.

2. Open the Winston AI developer dashboard.

3. Generate an API token.

4. Open the extension popup.

5. Select Winston AI.

6. Paste your token.

7. Save the key.

Winston developer documentation:

https://docs.gowinston.ai/

## Minimum words

Short text can give an AI detector too little writing signal to assess reliably.

The extension includes a configurable minimum word setting.

If a post, comment, or reply contains fewer words than your selected minimum, it is skipped and no detection request is made.

Winston AI also has its own minimum text requirement of 300 characters. That requirement applies even if your selected word minimum has already been reached.

## Result labels

### Zhuque AI

The extension can display:

`AI generated`

`Suspected AI`

`Human written`

Only the highest scoring result is shown beside analyzed content.

### Winston AI

The extension can display:

`AI generated`

`Human written`

Only the highest scoring result is shown beside analyzed content.

## Installation

1. Download or clone this repository.

2. Open Chrome.

3. Go to `chrome://extensions`.

4. Enable **Developer mode**.

5. Select **Load unpacked**.

6. Choose the extension folder.

7. Open the extension popup.

8. Select Zhuque AI or Winston AI.

9. Add your API key.

10. Configure your detection settings.

11. Open or refresh LinkedIn®.

## Troubleshooting

### Analysis failed after the first run

If the extension shows **Analysis failed** after the first run, refresh the LinkedIn® page and try again.

In most cases, refreshing the page allows analysis to start normally.

### No result appears

Check that **Detector enabled** is selected.

Check that the correct API key is saved for the selected provider.

Check that **Analyze posts** or **Analyze comments** is enabled for the content you are testing.

Check that the text meets your configured minimum word setting.

If Winston AI is selected, the text must also meet Winston's minimum of 300 characters.

### Cannot change provider

Untick **Detector enabled** first.

The provider controls are intentionally locked while detection is active.

### Comments are not detected

Expand the comments on LinkedIn® first.

You can also use **Check this page** inside the extension popup to inspect comment detection status.

## Privacy

The current BYOK build does not operate its own AI inference server.

Eligible visible post, comment, or reply text is sent directly from the extension to the detector selected by the user.

The extension is designed not to send images, private messages, profile URLs, or connection lists for AI analysis. Personal information contained inside the text of a post or comment may still be part of the submitted text.

Raw LinkedIn® text is used while the request is processed. Local result caching is designed around hashes and detector results rather than creating a permanent archive of LinkedIn® post content.

Provider data handling is governed by the provider you choose.

Review the privacy and data terms of Tencent EdgeOne or Winston AI before submitting sensitive content.

## API key security

Do not commit your personal API key to this repository.

Do not hard code your API key into the extension source.

Do not include real API keys in screenshots, issues, pull requests, sample configuration files, or test files.

The public repository should never contain provider credentials.

## RAID Benchmark

The extension includes a link to the public RAID Benchmark leaderboard as an external reference for AI text detection systems.

This project does not claim a fixed leaderboard position for any provider.

Leaderboard positions, detector versions, benchmark configurations, and results can change.

RAID leaderboard:

https://raid-bench.xyz/leaderboard

## Limitations

AI text detection cannot establish authorship with certainty.

Results can be affected by text length, rewriting, translation, paraphrasing, human editing, AI editing, mixed authorship, language support, model updates, and changes to LinkedIn® page structure.

The extension currently analyzes text only.

Images, audio, and video are not analyzed.

## Platform notice

LinkedIn publishes rules concerning browser extensions and third party software that scrape content, modify the LinkedIn experience, or automate activity.

Users and distributors of this project should review the current LinkedIn User Agreement and LinkedIn Help guidance before using or publishing the extension.

LinkedIn prohibited software and extensions guidance:

https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions

## Project status

Version 0.1 is an experimental public release.

The extension interface, LinkedIn® selectors, provider integrations, scoring presentation, and supported features may change as testing continues.

Bug reports and reproducible test cases are welcome.

## License

This project is source available under the PolyForm Noncommercial License 1.0.0.

Noncommercial use, modification, and redistribution are permitted under the license terms.

Commercial use is not permitted without separate written permission from the copyright holder.

See the `LICENSE` file for the full terms.

Official license:

https://polyformproject.org/licenses/noncommercial/1.0.0

## Trademark and independence

LinkedIn® is a registered trademark of LinkedIn Corporation and its affiliates.

This project is independent and is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation, Tencent, EdgeOne, Zhuque AI, or Winston AI.

All provider names, product names, and trademarks belong to their respective owners.

## References

Tencent EdgeOne Zhuque AI documentation:

https://cloud.tencent.com/document/product/1552/137539

Winston AI v2 text detection documentation:

https://docs.gowinston.ai/api-reference/v2/ai-content-detection/post

RAID Benchmark:

https://raid-bench.xyz/

PolyForm Noncommercial License 1.0.0:

https://polyformproject.org/licenses/noncommercial/1.0.0

LinkedIn prohibited software and extensions guidance:

https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions

Chrome extension documentation:

https://developer.chrome.com/docs/extensions/

## Author

Created by **Mayas Ötegen**

https://www.midnightlab.dev/
