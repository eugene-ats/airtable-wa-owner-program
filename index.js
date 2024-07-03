const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const fsP = require("fs/promises");
const fs = require("fs");
const prompt = require('prompt-sync')({sigint: true});
const Airtable = require('airtable');
const { APIKEY } = require("./auth-key.js");
const bukitTunkuDB = {
    tableId: 'appHFnui5sKZIuhrI',
    phoneNoFieldId: "fldgMYGalHYXKUpfe"
};
const condoBukitTunkuDB = {
    tableId: 'appeuMm0pg8nI8ECn',
    phoneNoFieldId: 'fldNBnySFvmlKyMqT'
};
const numFilePath = 'numbers.txt';
const PhoneNoArray = [];
const tables = [bukitTunkuDB, condoBukitTunkuDB];

if (APIKEY == "") {
    console.log("Please go to auth-key.js to enter your Airtable API key.\n");
    process.exit();
}

function printLineBreak() {
    console.log('\n:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:\n');  
}

// USER SIGN IN (SESSION WILL BE STORED)
printLineBreak();
console.log('Who is using this app? (New name will be auto registered as a new user)');
let userID = prompt('Username: ');


const client = new Client({
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth({
        clientId: userID
    }),
    webVersionCache: {
        type: "remote",
        remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
});
console.log('\nWhatsapp client created. Generating QR code... ');

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Open Whatsapp and scan qrcode above.');
});

client.on("ready", async () => {
    console.log("Successful login!");
    await sendMsg();
});

client.initialize();

// USER INPUT TO SELECT TARGET OWNERS (ONLY)
function reqTarget() {
    console.log("\nWho are your target recipients? ");
    console.log("1. Every owner in Bukit Tunku.");
    console.log("2. Owners living in a certain area in Bukit Tunku only.\n");
    let ans = prompt("Target recipients (1/2) : ");
    let keyword = [];
    if (ans == '1') {
        keyword = false;
    } else if (ans == '2') {
        console.log('');
        let res = prompt("Type in your target area(s) separated by comma (e.g. Jalan girdle, Tijani 2): ");
        keyword = res.split(",");
        keyword = keyword.map(titleCase);
        // console.log(keyword);
    } else {
        console.warn("Please give a valid response.\n");
        process.exit();
    }
    return keyword;
}

function createFormula(keyArr) {
    let findArr = [];
    for (const key of keyArr) {
        let findFormula = `FIND('${key}', Premise) >0`;
        findArr.push(findFormula);
    }
    let filterFormula = `IF(OR(${findArr.join(', ')}), "true", 0)`;
    // IF(OR(FIND('Girdle', Premise) >0, FIND(' Dalaman', Premise) >0), "true", 0)
    return filterFormula;
}

// RETRIEVE DATA FROM AIRTABLE
async function getPhoneNo() {
    let keyword = reqTarget();
    console.log("\nConnecting to Airtable API ...");
   
    const forEachPage = (records, fetchNextPage) => {
        // This function will get called for each page of records.
        records.forEach(async record => {
            let phonoNoCell = record.get('Phone no.');
            
            if (phonoNoCell && phonoNoCell != '') {
                
                let phoneNoList = phonoNoCell.split(',');
                let cleanPhoneNo = phoneNoList.map(rawNo => {
                    let onlyNo = removeSpecialChar(rawNo);
                    let trimmedNo = onlyNo.trim();
                    return trimmedNo;
                });

                cleanPhoneNo.forEach(phoneNo => {
                    if (!(phoneNo.startsWith('03')) && !(phoneNo.startsWith('603')) && !(phoneNo.startsWith('3')) && phoneNo != ' ') {
                        PhoneNoArray.push(phoneNo);
                    }
                });        
            }
        });
        fetchNextPage();
    }

    for (let u = 0; u < tables.length; u++) {
        let tableObj = tables[u]; 
        let tableId = tableObj['tableId'];
        let PNFid = tableObj['phoneNoFieldId'];     
        
        // AIRTABLE PERSONAL TOKEN & DATABASE ID
        const base = new Airtable(
            {apiKey: APIKEY}
        ).base(tableId);

        if (keyword) {
            await base('Owner').select({
                fields: [PNFid],
                filterByFormula: createFormula(keyword)
            }).eachPage(forEachPage).catch(error => { console.error(error); return false; }) 
        } else {
            await base('Owner').select({
                fields: [PNFid]
            }).eachPage(forEachPage).catch(error => { console.error(error); return false; }) 
        }
    }
    

    // WRITE PHONE NUMBERS INTO A TXT FILE
    await createNumFile(PhoneNoArray);
    return PhoneNoArray;
}

async function createNumFile(phoneNoArray) {
    // Overwriting existing data so that the line start fresh
    console.log('\nSuccessful connection. Generating phone number list.');
    await fsP.writeFile(numFilePath, phoneNoArray[0], err => {
        if (err) {
            console.log('Error encountered when writing to numbers.txt');
            console.error(err);
        }
    });
    // Append the remaining numbers to the file
    for (let i=1; i<phoneNoArray.length; i++) {
        let num = phoneNoArray[i];
        if (num.trim().length === 0) {continue}
        let data = "\n" + num;
        await fsP.appendFile(numFilePath, data, err => {
            if (err) {console.error(err);}
        });
    };
    console.log('\nOutput success. Ready to send Whatsapp message.');
    // return;
}

function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    return splitStr.join(' '); 
 }

function removeSpecialChar(number) {
    let regex = /[^0-9]/g;
    return number.replace(regex, '');
}

function checkNumber(number) {
    if(isNaN(number) || number.startsWith('00') || number == '' || number.length > 12) return false;
    return true;
}

function formatPhoneNo(number) {
    if (number.startsWith('03') || number.startsWith('603')) {
        return null
    } else if (number.startsWith('1')) {
        return ('60'+number)
    } else if (!number.startsWith('6') && number.startsWith('01')) {
        return ('6'+number)
    } else { return number }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// SEND CUSTOM MESSAGE TO SELECTED GROUP OF OWNERS
async function sendMsg() {
    // await getPhoneNo();

    let numbers = fs.readFileSync(numFilePath, "utf-8").split("\n");
    let notEmpty = false;
    // Check if the last line is an empty line
    while (!notEmpty) {
        if (numbers[numbers.length -1] == '') {
            numbers.pop();  // Remove empty line
            notEmpty = false;
        } else { notEmpty = true; }
    }
    console.log(`[ Sending to a total of ${numbers.length} numbers: ]\n`);

    // TODO: Maybe do a prompt select file
    console.log('Craft your message (Press enter to skip):\n')
    const mediaUrl = prompt("> Image relative file path (flyer/IMAGE NAME.jpg): ");
    const caption = prompt("> Message to send (Leave blank if you want to send image only): ");
    let media = false;
    if (mediaUrl.trim().length !== 0) {
        media = MessageMedia.fromFilePath(mediaUrl);
    } else if (caption.trim().length === 0 && media == false) {
        console.warn('You cannot send an empty message.');  // Check if both inputs are empty
        client.destroy();
        process.exit();
    }

    console.log("\nYour message is sending ...");

    let delivered = {};
    let sents = [];
    let duplicates = [];
    let invalids = [];
    for (let i = 0; i < numbers.length; i++) {
        let number = numbers[i].trim(); 

        if (!checkNumber(number)) {
            invalids.push(number);
            // console.log(`Found invalid number: ${number}`);
            // console.log(`number type: ${typeof number}`);
            continue;
        }

        number = formatPhoneNo(number);

        if (sents.includes(number)) {
            duplicates.push(number); 
            // console.log(`Already sent number: ${number}`);
            continue;
        }
        try {
            await delay(30000);  // 30-second delay between messages
            let delivery = undefined; 
            if (media == false) {
                delivery = await client.sendMessage(`${number}@c.us`, caption);
                // console.log('sent mssage without media to ' + number);
            } else {
                delivery = await client.sendMessage(`${number}@c.us`, media, {caption: caption});  
                // console.log('sent mssage with media to ' + number);
            }  
            sents.push(number);
            let status = await delivery.getInfo();
            if (delivery) {
                delivered[number] = delivery;
                // console.log(delivered);
            }
        } catch (e) {
            console.log(`Error sending message to ${number}: ${e.message}`);
            // Retry logic
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await delay(10000); // 10-second delay before retry
                    let delivery = await client.sendMessage(`${number}@c.us`, media ? media : caption, { caption });
                    sents.push(number);
                    if (delivery) {
                        delivered[number] = delivery;
                    }
                    break; // Break the retry loop on success
                } catch (retryError) {
                    console.log(`Retry ${attempt} failed for ${number}: ${retryError.message}`);
                    if (attempt === 3) {
                        console.log(`Failed to send message to ${number} after 3 retries.`);
                    }
                }
            }
        }
        if ((i + 1) % 50 === 0) {
            console.log('Taking a 10-minutes break...');
            await delay(600000); // 5-minute delay after every 50 messages
        }
    };
    
    // OPERATION REPORT
    printLineBreak();
    console.log('Operation report: \n');
    console.log(`☑️ Successfully sent message to ${sents.length} numbers.\n`);

    let duplicatesFilePath = "duplicates.txt";
    let invalidsFilePath = "invalids.txt";

    // Log to files
    let duplicatesMsg = `🔁 Found ${duplicates.length} duplicate numbers. (Check ${duplicatesFilePath} for the numbers.)\n`;
    let invalidMsg = `⚠️ ${invalids.length} were detected invalid numbers (invalid format). `;
    let invalidMsg2 = `Please check from ${invalidsFilePath} to \n> Find and fix the numbers in database. \n> Fix those numbers in fix.js, then run 'node fix.js' to send message to those numbers again.\n`;
    
    await logResults(duplicates, duplicatesFilePath, [duplicatesMsg, ""], false);
    await logResults(invalids, invalidsFilePath, [invalidMsg, invalidMsg2], true);

    // TODO: Write fix.js !!

    console.log("\n------------------------------------------\n");
    
    if (Object.keys(delivered).length == sents.length) {
        console.log('All message have been delivered.');
        client.destroy();
        process.exit();
    }
}

function listOutPhoneNo(noArr) {
    let data = '';
    if (noArr) {
        for (let i = 0; i < noArr.length; i++) {
            data = data + `${noArr[i]} \n`;
        }
    }
    return data;
}

async function logResults(noArr, path, msg, printOut) {
    let data = listOutPhoneNo(noArr);
    
    await fsP.writeFile(path, data, err => {
        if (err) {
            console.log(`Error encountered when writing to ${path}`);
            console.error(err);
        }
    });
    console.log(msg[0]);
    if (printOut) { console.log(data); } 
    if (msg[1]) { console.log(msg[1]); }
}