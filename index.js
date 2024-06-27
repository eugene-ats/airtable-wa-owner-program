const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const fsP = require("fs/promises");
const fs = require("fs");
const prompt = require('prompt-sync')({sigint: true});
const Airtable = require('airtable');

const base = new Airtable(
    {apiKey: 'patYJdMn1t77yxmVY.a1e684aa03c6cb74ce3469eabbfe7a4e83e7cc7ff7410b6bcd523841375c9e33'}
).base('appHFnui5sKZIuhrI');
const phoneNoFieldId = "fldgMYGalHYXKUpfe";
const premiseField = "fld1940nmpfJ4sbVy";

const numFilePath = 'numbers.txt';

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
  console.log('Open Whatsapp and scan qrcode above');
});

client.on("ready", async () => {
    console.log("Successful login!");
    await sendMsg();
});

// client.initialize();

function printLineBreak() {
    console.log('\n:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:\n');  
}

function reqTarget() {
    console.log("\nWho are your target recipients? ");
    console.log("1. Every owner in Bukit Tunku database.");
    console.log("2. Owners living in a certain area in Bukit Tunku only.\n");
    let ans = prompt("Target recipients (1/2) : ");
    let keyword = [];
    if (ans == '1') {
        keyword = false;
        console.log('sending to all owners.');
    } else if (ans == '2') {
        console.log('');
        let res = prompt("Type in your target area(s) separated by comma (e.g. Jalan girdle, Tijani 2): ");
        keyword = res.split(",");
        keyword = keyword.map(titleCase);
        console.log(keyword);
    } else {
        console.warn("Please give a valid response.");
        process.exit();
    }
    return keyword;
}

// findRec();
function findRec() {
    let premiseRec = base('Property').find('reccbZVZKvwlwFAap', function(err, rec) {  
        if (err) { 
            console.error('Error' + err); 
            // return; 
        }
        // console.log(rec);
        console.log(rec.fields['Street']);
        return rec.get("Street");
    });        
    console.log('PremiseRec' + premiseRec);
}

async function getOwnersPremiseName(premiseRecIdArr) {
    let premiseName = [];
    if (!premiseRecIdArr) { return false; }
    for (let recID of premiseRecIdArr) {
        console.log(recID);
        let premiseRec;
        base('Property').find(recID, function(err, rec) {  
            if (err) { 
                console.error('Error' + err); 
                return; 
            }
            console.log('this is rec' + rec.id);
            return premiseRec = rec;
        });
        if (!premiseRec) {
            console.log('found undefined');
        }
        let streetNameArr = premiseRec.get("Street");
        console.log(premiseRec);
        premiseName = [...premiseName, ...streetNameArr];
    }
    console.log(`premise name: ${premiseName}`);
    return premiseName;
}

function createFormula(keyArr) {
    let findArr = [];
    for (const key of keyArr) {
        let findFormula = `FIND('${key}', Premise) >0`;
        findArr.push(findFormula);
    }
    let filterFormula = `IF(OR(${findArr.join(', ')}), "true", 0)`;
    console.log(filterFormula);
    return filterFormula;
}

getPhoneNo();
async function getPhoneNo() {
    const PhoneNoArray = [];
    let keyword = reqTarget();
    console.log("\nConnecting to Airtable API ...");

    await base('Owner').select({
        fields: [phoneNoFieldId, premiseField],
        filterByFormula: createFormula(keyword)
    }).eachPage((records, fetchNextPage) => {
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
    }).catch(error => { console.error(error); return false; })

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


async function sendMsg() {
    await getPhoneNo();

    let numbers = fs.readFileSync(numFilePath, "utf-8").split("\n");
    console.log(`[ Sending to a total of ${numbers.length} numbers: ]\n`);

    // TODO: Maybe do a prompt select file
    console.log('Craft your message (Press enter to skip):')
    const mediaUrl = prompt("> Image relative file path (flyer images/IMAGE NAME.jpg): ");
    const caption = prompt("> Message to send (Leaev blank if you want to send image only): ");
    let media = false;
    if (mediaUrl.trim().length !== 0) {
        media = MessageMedia.fromFilePath(mediaUrl);
    } else if (caption.trim().length === 0 && media == false) {
        console.warn('You cannot send an empty message.');
        client.destroy();
        process.exit();
    }


    // TODO: Add filter owner group function

    let sents = [];
    let duplicates = [];
    let invalids = [];
    for (let number of numbers) {
        // if (number == null || number == ' ' || number == '') {
        //     console.log('returned');
        //     continue;
        // } 

        number = number.trim(); 

        if (!checkNumber(number)) {
            invalids.push(number);
            console.log(`Found invalid number: ${number}`);
            console.log(`number type: ${typeof number}`);
            continue;
        }

        number = formatPhoneNo(number);

        if (sents.includes(number)) {
            duplicates.push(number); 
            // console.log(`Already sent number: ${number}`);
            continue;
        }
        // try {
            if (media == false) {
                // await client.sendMessage(`${number}@c.us`, caption);
                console.log('sent mssage without media to ' + number);
            } else {
                // await client.sendMessage(`${number}@c.us`, media, {caption: caption});  
                console.log('sent mssage with media to ' + number);
            }   
            sents.push(number);
        // } catch (e) {
        //     console.log(`Error sending message: ${number}, ${e}`);
        // }
    };
    
    // OPERATION REPORT
    printLineBreak();
    console.log('Operation report: \n');
    console.log(`☑️ Successfully sent message to ${sents.length} numbers.\n`);

    let duplicatesFilePath = "duplicates.txt";
    let invalidsFilePath = "invalids.txt";

    // Log to files
    let duplicatesMsg = `🔁 Found ${duplicates.length} duplicate numbers. Check ${duplicatesFilePath} for the numbers.`;
    let invalidMsg = `⚠️ ${invalids.length} were detected invalid numbers (invalid format). \n`;
    let invalidMsg2 = `Please check from ${invalidsFilePath} to \n> Find and fix the numbers in database. \n> Fix those numbers in fix.js, then run 'node fix.js' to send message to those numbers again.\n`;
    
    // Log invalid number to file
    await logResults(duplicates, duplicatesFilePath, [duplicatesMsg, " "]);
    await logResults(invalids, invalidsFilePath, [invalidMsg, invalidMsg2]);

    // TODO: Write fix.js !!

    console.log("--------------------------------------");
    client.destroy();
    process.exit();
}

function listOutNo(noArr) {
    let data = '';
    for (let i = 1; i <= noArr.length; i++) {
        data = data + `${i}) ${noArr[i]} \n`;
    }
    return data;
}

async function logResults(noArr, path, msg) {
    let data = listOutNo(noArr);
    
    await fsP.writeFile(path, "hfjsaidfaopfh", err => {
        if (err) {
            console.log(`Error encountered when writing to ${path}`);
            console.error(err);
        }
    });
    console.log(msg[0]);
    console.log(data);
    console.log(msg[1]);

}