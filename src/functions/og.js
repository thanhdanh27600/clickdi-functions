const Handlebars = require("handlebars");
const puppeteer = require("puppeteer");
const { app } = require("@azure/functions");
const base64url = require("base64url");

const encodeBase64 = base64url.encode;
const decodeBase64 = base64url.decode;

const templateHTMLOg = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <style>{{styles}}</style>
  </head>
  <body id="body">
    <main>
      <div class='logo'>
        {{#if logoUrl}}
          <img src="{{logoUrl}}" alt="logo" />
        {{else}}
          <span>CLICKDI.top</span>
        {{/if}}
      </div>
      <div class="title">{{title}}</div>
      <div>
       
      </div>
    </main>
  </body>
</html>
`;

const templateStylesOg = `
* {
  box-sizing: border-box;
}
:root {
  font-size: 16px;
  font-family: monospace;
}
body {
  padding: 3rem;
  margin: 0;
  width: 1200px;
  height: 630px;
  overflow: hidden;
  background: #06b6d4;
  {{#if bgUrl}}
  background-image: url({{bgUrl}});
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  {{else}}
  color: black;
  {{/if}}
}
main {
  box-shadow: rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 4px double;
  padding: 2rem;
}
.logo {
  width: fit-content;
  align-self: center;
  height: 3rem;
}
.logo img {
  width: 100%;
  height: 100%;
}
.logo span {
  font-size: 1rem;
  padding: 0.5rem;
  display: flex;
  justify-content: center;
  border: 1px dashed;
}
.title {
  font-size: {{fontSize}};
  margin: 0.25rem;
  font-weight: bold;
  color: #fff;
  text-shadow: .15em .15em 0 hsl(200 50% 30%);
}
.tags {
  display: flex;
  list-style-type: none;
  padding-left: 0;
  color: #ff00d2;
  font-size: 1.5rem;
}
.tag-item {
  margin-right: 0.5rem;
}
.path {
  color: #6dd6ff;
  font-size: 1.25rem;
}
`;

// Get dynamic font size for title depending on its length
function getFontSize(title = "") {
	if (!title || typeof title !== "string") return "";
	const titleLength = title.length;
	if (titleLength > 100) return "2.5rem";
	if (titleLength > 80) return "3rem";
	if (titleLength > 60) return "3.75rem";
	if (titleLength > 40) return "4.25rem";
	if (titleLength > 30) return "4.75rem";
	return "5rem";
}

app.http("og", {
	methods: ["GET", "POST"],
	authLevel: "anonymous",
	handler: async (request, context) => {
		context.log(`Http function processed request for url "${request.url}"`);
		const titleQuery = request.query.get("title");
		const isPreview = request.query.get("preview") === "true";
		if (!titleQuery) {
			return { status: 400, body: "Invalid title" };
		}
		const title = decodeBase64(titleQuery);
		// const locale = req.body.locale;
		// const hash = req.body.hash;

		// compile templateStyles
		const compiledStyles = Handlebars.compile(templateStylesOg)({
			fontSize: getFontSize(title),
		});
		// compile templateHTML
		const compiledHTML = Handlebars.compile(templateHTMLOg)({
			title,
			styles: compiledStyles,
		});
		// return liveview html
		if (isPreview)
			return {
				headers: {
					"Content-Type": "text/html",
				},
				body: compiledHTML,
			};

		// puppeteer render and screenshot
		const browser = await puppeteer.launch({
			headless: "new",
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-accelerated-2d-canvas",
				"--no-first-run",
				"--no-zygote",
				"--single-process",
				"--disable-gpu",
			],
			defaultViewport: {
				width: 1200,
				height: 630,
				deviceScaleFactor: 1,
			},
		});
		const page = await browser.newPage();

		// Set the content to our rendered HTML
		await page.setContent(compiledHTML, { waitUntil: "domcontentloaded" });
		// Wait until all images and fonts have loaded
		await page.evaluate(async () => {
			const selectors = Array.from(document.querySelectorAll("img"));
			await Promise.all([
				document.fonts.ready,
				...selectors.map((img) => {
					// Image has already finished loading, let’s see if it worked
					if (img.complete) {
						// Image loaded and has presence
						if (img.naturalHeight !== 0) return;
						// Image failed, so it has no height
						throw new Error("Image failed to load");
					}
					// Image hasn’t loaded yet, added an event listener to know when it does
					return new Promise((resolve, reject) => {
						img.addEventListener("load", resolve);
						img.addEventListener("error", reject);
					});
				}),
			]);
		});

		const element = await page.$("#body");
		const image = await element?.screenshot({
			type: "jpeg",
			optimizeForSpeed: true,
		});
		await browser.close();
		return {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": `immutable, no-transform, s-max-age=604800, max-age=604800`,
				"Content-Length": image.length.toString(),
			},
			body: image,
		};
	},
});
