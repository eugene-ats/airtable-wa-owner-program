const fsP = require("fs/promises");
const fs = require("fs");
const prompt = require('prompt-sync')({sigint: true});
const Airtable = require('airtable');
const { APIKEY } = require("./auth-key.js");
const bukitTunkuDB = {
    tableId: 'appHFnui5sKZIuhrI',
    phoneNoFieldId: "fldgMYGalHYXKUpfe", 
    nameFieldId: "fld5BMIgdThbjFmcF"
};
const condoBukitTunkuDB = {
    tableId: 'appeuMm0pg8nI8ECn',
    phoneNoFieldId: 'fldNBnySFvmlKyMqT',
    nameFieldId: "fldCqbAYxHFzjjJnk"
};
const numListCsv = 'list.csv';
const invalidsFilePath = 'invalids.txt';
const PhoneNoArray = [];
const NameArray = [];
const invalids = [];
const tables = [bukitTunkuDB, condoBukitTunkuDB];

if (APIKEY == "") {
    console.log("Please go to auth-key.js to enter your Airtable API key.\n");
    process.exit();
}

function printLineBreak() {
    console.log('\n:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:=:\n');  
}

function removeSpecialChar(number) {
    let regex = /[^0-9]/g;
    return number.replace(regex, '');
}

// RETRIEVE DATA FROM AIRTABLE
async function getPhoneNo() {
    let keyword = reqTarget();
    console.log("\nConnecting to Airtable API ...");
   
    const forEachPage = (records, fetchNextPage) => {
        // This function will get called for each page of records.
        records.forEach(async record => {
            let phonoNoCell = record.get('Phone no.');
            let nameCell = record.get('Name');
            
            if (phonoNoCell && phonoNoCell != '') {
                let phoneNoList = phonoNoCell.split(',');
                let cleanPhoneNo = phoneNoList.map(rawNo => {
                    let onlyNo = removeSpecialChar(rawNo);
                    let trimmedNo = onlyNo.trim();
                    return trimmedNo;
                });

                cleanPhoneNo.forEach(phoneNo => {
                    if (phoneNo.startsWith('01') || phoneNo.startsWith('1') || phoneNo.startsWith('601')) {
                        if (phoneNo.length <= 12) {
                            PhoneNoArray.push(phoneNo);
                            NameArray.push(nameCell);
                        } else {
                            console.log('Invalid format: ' + phoneNo);
                            invalids.push(phoneNo);
                        }
                    }
                });        
            }
        });
        fetchNextPage();
    }

    // Go over Bukit Tunku table & Condo in Bukit Tunku table
    for (let u = 0; u < tables.length; u++) {
        let tableObj = tables[u]; 
        let tableId = tableObj['tableId'];
        let PNFid = tableObj['phoneNoFieldId'];  
        let nameFieldId = tableObj['nameFieldId'];  
        
        // AIRTABLE PERSONAL TOKEN & DATABASE ID
        const base = new Airtable(
            {apiKey: APIKEY}
        ).base(tableId);

        if (keyword) {
            await base('Owner').select({
                fields: [PNFid, nameFieldId],
                filterByFormula: createFormula(keyword)
            }).eachPage(forEachPage).catch(error => { console.error(error); return false; }) 
        } else {
            await base('Owner').select({
                fields: [PNFid, nameFieldId]
            }).eachPage(forEachPage).catch(error => { console.error(error); return false; }) 
        }
    }
    

    // WRITE PHONE NUMBERS INTO A TXT FILE
    await createNumFile(PhoneNoArray, NameArray);
    return PhoneNoArray;
}

async function createNumFile(phoneNoArray, nameArray) {
    // Overwriting existing data so that the line start fresh
    console.log('\nGenerating phone number list.');

    let notEmpty = false;
    // Check if the last line is an empty line
    while (!notEmpty) {
        if (phoneNoArray[phoneNoArray.length -1] == '') {
            phoneNoArray.pop();  // Remove empty line
            notEmpty = false;
        } else { notEmpty = true; }
    }
    phoneNoArray = phoneNoArray.map(formatPhoneNo);
    console.log(`[ Writing a total of ${phoneNoArray.length} numbers into csv file: ]\n`);

    let written = [];
    await fsP.writeFile(numListCsv, `${nameArray[0]},${phoneNoArray[0]}`, err => {
        if (err) {
            console.log('Error encountered when writing to numbers.txt');
            console.error(err);
        }
    });
    written.push(phoneNoArray[0]);

    // Append the remaining numbers to the file
    for (let i=1; i<phoneNoArray.length; i++) {
        let name = nameArray[i];
        let num = phoneNoArray[i];
        if (written.includes(num)) { continue }
        if (num.trim().length === 0) {continue}
        let data = `\n${name},${num}`;
        await fsP.appendFile(numListCsv, data, err => {
            if (err) {console.error(err);}
        });
        written.push(num);
    };
    printLineBreak();
    console.log('\nFile generated: ' +numListCsv);

    await fsP.writeFile(invalidsFilePath, invalids[0], err => {
        if (err) {
            console.log('Error encountered when writing to numbers.txt');
            console.error(err);
        }
    });
    // Append the remaining numbers to the file
    for (let i=1; i<invalids.length; i++) {
        let num = invalids[i];
        // if (num.trim().length === 0) {continue}
        let data = "\n" + num;
        await fsP.appendFile(invalidsFilePath, data, err => {
            if (err) {console.error(err);}
        });
    };
    console.log('\n' + invalids.length + ' invalid numbers found: ' +invalidsFilePath);
    // return;
}

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

function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    return splitStr.join(' '); 
}

// function checkNumber(number) {
//     if(isNaN(number) || number.startsWith('00') || number == '' || number.length > 12) return false;
//     return true;
// }

function formatPhoneNo(number) {
    if (number.startsWith('1')) {
        return ('60'+number)
    } else if (!number.startsWith('6') && number.startsWith('01')) {
        return ('6'+number)
    } else { return number }
}

getPhoneNo();