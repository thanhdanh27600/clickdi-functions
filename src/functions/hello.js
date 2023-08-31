const {app} = require("@azure/functions");

app.http("hello", {
	methods: ["GET", "POST"],
	authLevel: "anonymous",
	handler: async (request, context) => {
		context.log(`Http function processed request for url "${request.url}"`);
		const name = "Clickdi fam!";
		return {body: `Hello, ${name}!`};
	},
});
