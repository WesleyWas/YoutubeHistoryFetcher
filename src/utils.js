const axios = require('axios');

const batchEndpointURL = "https://api.flusk.eu/api:9itqhmbJ/batch-webhook";
const finishExtractEndpointURL = "https://api.flusk.eu/api:9itqhmbJ/finish-extract";

async function sendBatchToXano(data){
    if(!data) return;

    const options = {
        headers: {
            'Content-Type': 'application/json'
        }
    }

    try{
        let res = await axios.post(batchEndpointURL, data, options);

        return res;
    }catch(e){
        console.log("[x] Error sending webhook to Xano..." + e);
    }
}

async function sendFinishedExtractToXano(data){
    if(!data) return;

    const options = {
        headers: {
            'Content-Type': 'application/json'
        }
    }

    try{
        let res = await axios.post(finishExtractEndpointURL, data, options);

        return res;
    }catch(e){
        console.log("[x] Error sending webhook to Xano..." + e);
    }
}

function createUniqueIdentifier(user_uuid){
    const now = Date.now();
    return user_uuid + "+" + now;
}

function frenchDateToJSDate(frenchDateStr) {
    const today = new Date();
    const thisYear = today.getFullYear();

    // Case 1: Hier (Yesterday)
    if (frenchDateStr === 'Hier') {
        today.setDate(today.getDate() - 1);
        return today;
    }

    //Case 1 bis : Aujourd'hui (Today)
    if (frenchDateStr === "Aujourd'hui"){
        return today;
    }

    // Case for weekdays
    const weekdays = {
        'dimanche': 0,
        'lundi': 1,
        'mardi': 2,
        'mercredi': 3,
        'jeudi': 4,
        'vendredi': 5,
        'samedi': 6
    };

    if (weekdays[frenchDateStr.toLowerCase()] !== undefined) {
        const targetDay = weekdays[frenchDateStr.toLowerCase()];
        const daysDifference = today.getDay() - targetDay;

        // If today is on or before the target day, subtract an additional 7 days
        // This ensures we get last week's day
        if (daysDifference <= 0) {
            today.setDate(today.getDate() - 7 - daysDifference);
        } else {
            today.setDate(today.getDate() - daysDifference);
        }
        return today;
    }

    const months = {
        'janv': 0,
        'févr': 1,
        'mars': 2,
        'avr': 3,
        'mai': 4,
        'juin': 5,
        'juil': 6,
        'août': 7,
        'sept': 8,
        'oct': 9,
        'nov': 10,
        'déc': 11
    };

    const fullMonths = {
        'janvier': 0,
        'février': 1,
        'mars': 2,
        'avril': 3,
        'mai': 4,
        'juin': 5,
        'juillet': 6,
        'août': 7,
        'septembre': 8,
        'octobre': 9,
        'novembre': 10,
        'décembre': 11
    };

    // Case 2: Day and Month, e.g., "3 Juillet"
    const dayMonthPattern = /(\d+)\s+([^0-9\s]+)/;
    const dayMonthMatch = frenchDateStr.trim().match(dayMonthPattern);
    if (dayMonthMatch) {
        const day = parseInt(dayMonthMatch[1], 10);
        const monthName = dayMonthMatch[2];
        const month = fullMonths[monthName];

        if (typeof month !== 'undefined') {
            return new Date(thisYear, month, day);
        }
    }

    // Case 3: Day, Month and Year, e.g., "2 déc. 2022"
    const fullDatePattern = /(\d+) ([a-zé]+\.?) (\d+)/i;
    const fullDateMatch = frenchDateStr.match(fullDatePattern);

    if (fullDateMatch) {
        const day = parseInt(fullDateMatch[1], 10);
        const monthName = fullDateMatch[2].toLowerCase().replace('.', '');
        const year = parseInt(fullDateMatch[3], 10);

        const month = months[monthName];

        if (typeof month !== 'undefined') {
            return new Date(year, month, day);
        }
    }

    // If none of the patterns match, return null or throw an error
    return null;
}

module.exports = { frenchDateToJSDate, sendBatchToXano, sendFinishedExtractToXano, createUniqueIdentifier }