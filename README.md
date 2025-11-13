AI chatlog used in the creation of this app: [link](https://chatgpt.com/share/6915248f-4464-8007-8701-f5187f0504a3)

This assignment has two parts: transcript generation, web app

## Web app

This uses vanilla html/css/javascript. It features three panels, one for the transcript, one for the audio, and one for commentary. These are all seekable. Additionally there is a follow checkbox for automatically syncing audio with transcript/commentary. Finally, you can toggle each type of commentary using the provided checkboxes.

### Known Bugs

The seeking is a bit strange as you need to click on the exact timestamp for the seeking to work on other panels (e.g. if you click on 12:51 in transcript and if 12:51 doesn't exist in commentary, it won't seek).

## Transcript generation

This uses the Assembly AI API to emit javascript following the data.js schema