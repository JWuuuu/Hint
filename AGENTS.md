# Hint App workspace instructions

## Running the site for the user

When the user asks to "run this site", "run the site", "运行这个网站", or otherwise asks to open the local Hint app for preview:

1. Start the existing Hint web development server.
2. Open `http://localhost:5173/iphone17-pro-preview.html` by default.
3. Keep the preview page visible for the user. It must show the complete iPhone 17 Pro device frame, including the rounded chassis, screen bezel, side buttons, and Dynamic Island, with the interactive Hint app rendered inside it.
4. Do not open `/app` directly unless the user explicitly asks for the frameless app or for responsive-layout debugging.

The device preview is a local presentation/testing surface only. Do not change production routing or deployment behavior to make it the public home page unless the user explicitly requests that change.
