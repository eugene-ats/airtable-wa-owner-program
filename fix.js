const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const fsP = require("fs/promises");
const fs = require("fs");
const { sensitiveHeaders } = require("http2");
const prompt = require('prompt-sync')({sigint: true});

printLineBreak();
console.log('Who is using this app? (New name will be auto registered as a new user)');
let userID = prompt('Username: ');

const client = new Client({
    puppeteer: {
        headless: false,
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

function printLineBreak() {
    console.log('\n:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:\n');  
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

const invalidsFilePath = "invalids.txt";
async function sendMsg() {
    let numbers = fs.readFileSync(invalidsFilePath, "utf-8").split("\n");
    let notEmpty = false;
    while (!notEmpty) {
        if (numbers[numbers.length -1] == '') {
            numbers.pop();
            notEmpty = false;
        } else { notEmpty = true; }
    }
    console.log(`[ Attempting to send message to ${numbers.length} validated numbers: ]\n`);

    // TODO: Maybe do a prompt select file
    console.log('Craft your message (Press enter to skip):\n')
    const mediaUrl = prompt("> Image relative file path (flyer/IMAGE NAME.jpg): ");
    const caption = prompt("> Message to send (Leave blank if you want to send image only): ");
    let media = false;
    if (mediaUrl.trim().length !== 0) {
        media = MessageMedia.fromFilePath(mediaUrl);
    } else if (caption.trim().length === 0 && media == false) {
        console.warn('You cannot send an empty message.');
        client.destroy();
        process.exit();
    }

    let sents = [];
    let delivered = {};
    let invalids = [];
    for (let number of numbers) {
        number = number.trim(); 

        if (!checkNumber(number)) {
            invalids.push(number);
            // console.log(`Found invalid number: ${number}`);
            // console.log(`number type: ${typeof number}`);
            continue;
        }

        number = formatPhoneNo(number);

        try {
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
            // let remaining = status.deliveryRemaining;
            // console.log("delivery remaining " + remaining);
            // while (remaining > 0) {
            //     console.log('1');
            //     status = await delivery.getInfo();
            //     remaining = status['deliveryRemaining'];
            //     if (remaining == 0) {
            //         console.log('remaing is 0');
            //         delivered.push(number);
            //         break;
            //     }
            // } 
            // if (remaining == 0) {
            //     console.log('remaing is zero');
            //     delivered.push(number);
            // }
            
        } catch (e) {
            console.log(`Error sending message: ${number}, ${e}`);
        }
    };
    
    // OPERATION REPORT
    printLineBreak();
    console.log('Operation report: \n');
    console.log(`☑️ Successfully sent message to ${sents.length} numbers.\n`);

    // Log to files
    if (sents.length == numbers.length) {
        console.log("0 invalid number left. ");
        await fsP.writeFile(invalidsFilePath, '', err => {
            if (err) {
                console.log(`Error encountered when writing to ${path}`);
                console.error(err);
            }
        });
    } else {
        let leftInvalids = numbers.length - sents.length;
        console.log(leftInvalids + " numbers are still invalid. Please check invalids.txt and fix them.");
        await logResults(invalids, invalidsFilePath);
    }

    console.log("\n------------------------------------------\n");
    // console.log("\n[ Your message is sending... ]\n");

    // console.log(Object.keys(delivered).length == sents.length);
    if (Object.keys(delivered).length == sents.length) {
        console.log('All message have been delivered.');
        client.destroy();
        process.exit();
    }
}

async function logResults(noArr, path) {
    let data = listOutPhoneNo(noArr);
    
    await fsP.writeFile(path, data, err => {
        if (err) {
            console.log(`Error encountered when writing to ${path}`);
            console.error(err);
        }
    });
    console.log(data);
}

function listOutPhoneNo(noArr) {
    let data = '';
    for (let i = 0; i < noArr.length; i++) {
        data = data + `${noArr[i]} \n`;
    }
    return data;
}