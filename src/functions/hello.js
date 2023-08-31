const {app} = require("@azure/functions");
const requestIP = require("request-ip");

app.http("hello", {
	methods: ["GET", "POST"],
	authLevel: "anonymous",
	handler: async (request, context) => {
		context.log(
			`Http function processed request for url "${
				request.url
			}", from ip ${requestIP.getClientIp(request)}`
		);
		const name = requestIP.getClientIp(request) || "Clickdi fam!";
		return {body: `Hello, ${name}!`};
	},
});
