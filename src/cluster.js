const env = require("process");
const { puppet } = require("./puppet");
const { Cluster } = require("puppeteer-cluster");
const { sendFinishedExtractToXano } = require('./utils');

class NodeCluster{

    cluster;
    headless = process.env.HEADLESS || "new";
    //headless = false;

    async start(){
        this.cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_BROWSER,
            maxConcurrency: 1,
            timeout: 4800000,
            workerCreationDelay: 100,
            puppeteerOptions: {
                headless: this.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                defaultViewport: {
                    width: 1920,
                    height: 1080
                }
            }
        });

        this.cluster.task(async ({page, data: payload}) => {

            console.log("[+] Starting puppet task.");
            const result = await puppet(page, payload);
            console.log("[+] End of task. Can now send webhook...");
            let webhook = await sendFinishedExtractToXano(result);

            console.log("[+] Webhook sent.");
            return webhook;
        });

        console.log("[+] Clusted started.");
    }

    getCluster(){
        return this.cluster;
    }

}

module.exports = { NodeCluster }