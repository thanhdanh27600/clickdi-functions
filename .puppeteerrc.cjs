// .puppeteerrc.cjs
const path = require("path");

module.exports = {
	cacheDirectory:
		process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development"
			? undefined
			: path.join(__dirname, ".cache", "puppeteer"),
};
