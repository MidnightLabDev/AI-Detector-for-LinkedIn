<div align="center">

<img src="AI_Detector_for_LinkedIn_BYOK_0.1/icons/128.png" alt="AI Detector icon" width="96">

<h1>AI Detector for LinkedIn®</h1>

<p>Detect AI generated writing directly inside LinkedIn® posts, comments, and replies.</p>

<p><strong>Bring your own Zhuque AI API key.</strong></p>

<p>Version 0.1</p>
<img width="1672" height="941" alt="LinkedIn AI Detector Extension Preview" src="https://github.com/user-attachments/assets/f7c07525-7a57-497b-9829-750bc51bc816" />

</div>

## About

AI Detector for LinkedIn® is a Chrome extension that analyzes eligible text while you browse LinkedIn® and displays an AI authorship estimate beside posts, comments, and replies.

The current release uses **Zhuque AI** through Tencent EdgeOne Makers.

The extension follows a bring your own API key model. Your own Tencent EdgeOne API key is used for detection.

AI detection is probabilistic. A result is an estimate, not proof of authorship.

## Features

1. Detects eligible LinkedIn® posts.

2. Detects comments and replies.

3. Displays the highest scoring result beside analyzed content.

4. Supports **Human written**, **Suspected AI**, and **AI generated** results.

5. Lets you set the minimum number of words required before analysis starts.

6. Lets you enable or disable post analysis and comment analysis separately.

7. Uses your own Zhuque AI API key.

8. Keeps the API key in the browser session by default.

9. Can optionally remember the API key on the current device.

10. Includes a built in guide for getting a Tencent EdgeOne API key.

11. Includes a link to the public RAID Benchmark leaderboard for external reference.

12. Includes page diagnostics for checking comment detection.

## Zhuque AI

Zhuque AI is accessed through Tencent EdgeOne Makers using the `@makers/zhuque-text` model.

Tencent documents three text classifications:

`Human`

`AI`

`Suspected AI`

The extension keeps these classifications separate and displays the category with the highest returned proportion.

Official Tencent documentation:

https://cloud.tencent.com/document/product/1552/137539

## English only

This version of the extension uses Zhuque AI for **English text only**.

Text is sent to Zhuque only when Chrome reliably identifies the content as English.

If the language cannot be reliably confirmed as English, the text is skipped and is not sent to Zhuque.

This restriction is applied by the extension.

## Bring your own API key

This release does not provide shared detector credits.

Each user supplies their own Tencent EdgeOne API key.

By default, the key is kept in the browser session.

If you select **Remember on this device**, the key is stored in local extension storage for that browser profile.

The API key is not included in the source code.

## How to get a Zhuque AI API key

1. Open Tencent EdgeOne Makers.

2. Open **Models**.

3. Open **API Key**: https://console.tencentcloud.com/edgeone/makers?tab=models&subTab=apikey

4. Create a new API key.

5. Open the extension popup.

6. Paste your EdgeOne API key.

7. Save the key.

8. Enable the detector.

Tencent Zhuque AI documentation:

https://cloud.tencent.com/document/product/1552/137539

## Minimum words

Very short text can provide too little writing signal for meaningful AI detection.

The extension includes a configurable minimum word setting.

If a post, comment, or reply contains fewer words than your selected minimum, it is skipped and no Zhuque request is made.

## Result labels

The extension can display:

`Human written`

`Suspected AI`

`AI generated`

Only the highest scoring result is shown beside each analyzed post, comment, or reply.

## Installation

1. Download or clone this repository.

2. Open Chrome.

3. Go to `chrome://extensions`.

4. Enable **Developer mode**.

5. Select **Load unpacked**.

6. Choose the extension folder.

7. Open the extension popup.

8. Add your Tencent EdgeOne API key.

9. Configure your detection settings.

10. Open or refresh LinkedIn®.

## Troubleshooting

### Analysis failed after the first run

If the extension shows **Analysis failed** after the first run, refresh the LinkedIn® page and try again.

In most cases, refreshing the page allows analysis to start normally.

### No result appears

Check that **Detector enabled** is selected.

Check that your Zhuque AI API key is saved.

Check that **Analyze posts** or **Analyze comments** is enabled for the content you are testing.

Check that the text meets your configured minimum word setting.

Check that the text is English.

If Chrome cannot reliably identify the text as English, the extension skips it.

### Comments are not detected

Expand the comments on LinkedIn® first.

Scroll the comments into view.

You can also use **Check this page** inside the extension popup to inspect comment detection status.

## Privacy

The current BYOK build does not operate its own AI inference server.

Eligible visible post, comment, or reply text is sent directly from the extension to Zhuque AI through Tencent EdgeOne.

The extension is designed not to send images, private messages, profile URLs, or connection lists for AI analysis.

Personal information written inside the body of a post or comment may still be part of the submitted text.

Raw LinkedIn® text is used while a request is being processed.

Local result caching is designed around text hashes and detector results rather than creating a permanent archive of LinkedIn® post content.

Provider data handling is governed by Tencent EdgeOne.

Review Tencent's current terms and privacy practices before using the extension with sensitive content.

## RAID Benchmark

The extension includes a link to the public RAID Benchmark leaderboard as an external reference for AI text detection systems.

This project does not claim a fixed leaderboard position.

Leaderboard positions, detector versions, benchmark configurations, and results can change.

RAID leaderboard:

https://raid-bench.xyz/leaderboard

## Limitations

AI text detection cannot establish authorship with certainty.

Results can be affected by text length, rewriting, translation, paraphrasing, human editing, AI editing, mixed authorship, formatting, model updates, and changes to LinkedIn® page structure.

This release analyzes English text only.

Images, audio, and video are not analyzed.

## Platform notice

LinkedIn publishes rules concerning browser extensions and third party software that scrape content, modify the LinkedIn experience, or automate activity.

Users and distributors of this project should review the current LinkedIn User Agreement and LinkedIn Help guidance before using or publishing the extension.

LinkedIn guidance:

https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions

## Project status

Version 0.1 is an experimental public release.

The interface, LinkedIn® selectors, provider integration, scoring presentation, and supported features may change as testing continues.

Bug reports and reproducible test cases are welcome.

## License

This project is source available under the **PolyForm Noncommercial License 1.0.0**.

Noncommercial use, modification, and redistribution are permitted under the license terms.

Commercial use is not permitted without separate written permission from the copyright holder.

See the `LICENSE` file for the full terms.

Official license:

https://polyformproject.org/licenses/noncommercial/1.0.0

## Trademark and independence

LinkedIn® is a registered trademark of LinkedIn Corporation and its affiliates.

This project is independent and is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation, Tencent, EdgeOne, or Zhuque AI.

All provider names, product names, and trademarks belong to their respective owners.

## References

Tencent EdgeOne Zhuque AI documentation:

https://cloud.tencent.com/document/product/1552/137539

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
