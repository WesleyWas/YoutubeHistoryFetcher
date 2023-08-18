// Importing Puppeteer & Packages
const puppeteer = require("puppeteer");
const os = require('os');
const { frenchDateToJSDate, createUniqueIdentifier, sendBatchToXano} = require('./utils');

async function scrapeAndStructureData(page){
    if(!page) return;
    try{
        const prods = await page.$$eval('ytd-video-renderer.style-scope.ytd-item-section-renderer[bigger-thumbs-style="DEFAULT"][lockup="true"][inline-title-icon][is-history]', async containers => {
            let videoData = [];
            const chunkSize = 100;
            let chunk = Array.from(containers).slice(0, chunkSize);
            console.log("[+] Processing " + chunk.length + " items...");
            chunk.forEach((element) => {
                const videoObject = element.querySelector('#dismissible');

                const videoTitle = videoObject.querySelector('#video-title').getAttribute("title")?.trim().replace('.', '');
                const channelName = videoObject.querySelector('#channel-name').querySelector('#container').querySelector('#text-container').querySelector('#text').getAttribute("title")?.trim().replace('.', '');
                const views = videoObject.querySelector('#metadata-line').querySelector('span')?.textContent?.trim();
                const description = videoObject.querySelector('#description-text')?.textContent?.trim().replace('.', '');
                let leftPart = views.split(' ')[0];
                let digits = leftPart.split(/\s+/)[0].replace(',', '.');
                let parsedDigits = parseFloat(digits);
                const multi = leftPart.split(/\s+/)[1];

                if (multi === 'M') parsedDigits *= 10e6;
                else if (multi === 'k') parsedDigits *= 10e3;
                else if (multi === 'Md') parsedDigits *= 10e9;

                const threeGrandpa = videoObject.parentNode.parentNode.parentNode;
                let date = threeGrandpa.querySelector('#header').querySelector('#header').querySelector('#title')?.textContent?.trim();

                let data = {
                    title: videoTitle,
                    description: description,
                    channelName: channelName,
                    views: parsedDigits,
                    rawViews: views,
                    unprocessedDate: date,
                }

                videoData.push(data);
            });

            return videoData;
        });

        // Remove the items from the page
        await page.evaluate(() => {
            const elements = document.querySelectorAll('ytd-video-renderer.style-scope.ytd-item-section-renderer[bigger-thumbs-style="DEFAULT"][lockup="true"][inline-title-icon][is-history]');
            for (let i = 0; i < Math.min(100, elements.length); i++) {
                elements[i].remove();
            }
        });
        console.log("[+] Removed 100 items.");

        return prods;
    }catch(e){
        console.log("[x] Error structuring / parsing data: " + e);
    }
}

async function autoScrollAndSave(page) {
    try{
        return page.evaluate(async () => {
            return new Promise((resolve) => {
                const scrollInterval = 500;  // ms
                const scrollStep = 500;    // pixels, increased scroll step
                let i = 0;

                let scrollIntervalID = setInterval(() => {
                    window.scrollBy(0, scrollStep);
                    i += 1;
                }, scrollInterval);

                let lastScrollPosition = -1;  // Initializing to an impossible value
                let unchangedPositionHits = 0;
                let checkPositionIntervalID = setInterval(() => {

                    if (window.scrollY === lastScrollPosition) {
                        unchangedPositionHits++;
                        if (unchangedPositionHits >= 2) {  // if unchanged for 20 seconds
                            clearInterval(scrollIntervalID);
                            clearInterval(checkPositionIntervalID);
                            resolve();
                        }
                    } else {
                        lastScrollPosition = window.scrollY;  // Update last known scroll position
                        unchangedPositionHits = 0;  // Reset if scroll position has changed
                    }
                }, 10000);  // Check every 10 seconds
            });
        });
    }catch(e){
        console.log("[x] Error scrolling the page: " + e);
    }
}

function formatDates(data, user_uuid){
    if(!data) return;
    data.forEach((data) => {
        const viewedDate = frenchDateToJSDate(data.unprocessedDate);
        const identifier = user_uuid + "+" + data.title + "+" + Date.now();
        data["formattedDate"] = viewedDate;
        data["user_uuid"] = user_uuid;
        data["identifier"] = identifier;
    });
    return data;
}

async function scrapeHistory(page, user_uuid){
    try {
        if(page.isClosed()) return;
        await page.waitForFunction(() => {
            return document.querySelectorAll('ytd-video-renderer.style-scope.ytd-item-section-renderer[bigger-thumbs-style="DEFAULT"][lockup="true"][inline-title-icon][is-history]').length >= 100;
        });

        console.log("[+] Structuring & scraping data...");
        let raw = await scrapeAndStructureData(page, user_uuid);
        let formattedData = formatDates(raw, user_uuid);
        return formattedData;
        console.log("Just added +100 items.");
    }catch (e) {
        console.log("[x] Error while scraping history: " + e);
    }
}


// Puppet
const puppet = async (page, payload) => {

    const URL = "https://www.youtube.com/feed/history";
    let data = [];
    //Create a unique identifier for the batch export
    const identifier = createUniqueIdentifier(payload.user_uuid);
    console.log("[+] New export batch with identifier: " + identifier + " with user_uuid: " + payload.user_uuid);

    page.on('error', err => {
        console.log('Page error: ', err.toString());
    });

    try{
        //Registering dialog accept
        page.on('dialog', async dialog => {
            console.log("A dialog has been automatically accepted.");
            await dialog.accept();
        });

        //Set cookies
        console.log("[+] Defining cookies for tab...");
        for (let cookie of payload.cookies) {
            await page.setCookie(cookie);
        }

        await page.waitForTimeout(2000)

        // Creating Tab & Navigating to URL
        console.log("[+] Creating New Tab & Navigating to URL: " + URL);
        await page.goto(URL);

        await page.waitForTimeout(2000);

        console.log("[+] Starting infinite scroll...");
        let scrollPromise = autoScrollAndSave(page);
        console.log("[+] Starting scraping...");

        const scrapeDelay = 5;
        let scrapeIntervalID = setInterval(async () => {
            let length = await page.evaluate(() => {
                return document.querySelectorAll('ytd-video-renderer.style-scope.ytd-item-section-renderer[bigger-thumbs-style="DEFAULT"][lockup="true"][inline-title-icon][is-history]').length;
            });
            console.log("Fetching... (currently " + length + " elements)");
            let results = await scrapeHistory(page, payload.user_uuid);
            if(results && results.length !== 0){
                await sendBatchToXano({
                    data: results,
                    export_identifier: identifier,
                    user_uuid: payload.user_uuid
                });
                console.log("[+] Sent a batch of " + results.length + " items to Xano. Identifier: " + identifier);
            }
        }, scrapeDelay*1000);

        console.log("Timeout...");
        await page.waitForTimeout(2000);

        //Awaiting the scroll to be ended to resolve the promise
        console.log("[+] Now waiting for the scroll to complete while saving data...");
        await scrollPromise;

        //Clear scrape timeout
        clearInterval(scrapeIntervalID);

        console.log("End of puppet task");

        await page.close();

        return {
            user_uuid: payload.user_uuid,
            identifier: identifier
        };
    }catch(e){
        return "Puppeteer error: " + e;
    }
}

module.exports = { puppet };