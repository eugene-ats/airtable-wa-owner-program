const Airtable = require('airtable');
const fs = require('fs');
const base = new Airtable(
    {apiKey: 'patYJdMn1t77yxmVY.a1e684aa03c6cb74ce3469eabbfe7a4e83e7cc7ff7410b6bcd523841375c9e33'}
).base('appHFnui5sKZIuhrI');
const phoneNoFieldId = "fldgMYGalHYXKUpfe"


async function getPhoneNo() {
    const PhoneNoArray = [];

    await base('Owner').select({
        fields: [phoneNoFieldId]
    }).eachPage((records, fetchNextPage) => {
        // This function (`page`) will get called for each page of records.
        records.forEach(record => {
            let cellValue = record.get('Phone no.');
            if (cellValue) {
                let phoneNoList = cellValue.split(',');
                let cleanPhoneNo = phoneNoList.map(rawNo => {
                    let onlyNo = removeSpecialChar(rawNo);
                    let trimmedNo = onlyNo.trim();
                    return trimmedNo;
                });

                cleanPhoneNo.forEach(phoneNo => {
                    if (!(phoneNo.startsWith('03')) && !(phoneNo.startsWith('603')) && !(phoneNo.startsWith('3'))) {
                        PhoneNoArray.push(phoneNo);
                    }
                });
            }
        });
        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();
    }).catch(error => { console.error(error); return false; })

    createNumFile(PhoneNoArray);
    return PhoneNoArray;
}


function removeSpecialChar(number) {
    let regex = /[^0-9]/g;
    return number.replace(regex, '');
}

function createNumFile(phoneNoArray) {
    let numFilePath = 'numbers.txt';
    // Writing the first num to numbers.txt. All existing data will be overwritten
    
    fs.writeFile(numFilePath, phoneNoArray[0], err => {
        if (err) {
            console.log('Error encountered when writing to numbers.txt');
            console.error(err);
        }
    });
    // Append the remaining numbers to the file
    phoneNoArray.forEach(num => {
        let data = "\n" + num;
        fs.appendFile(numFilePath, data, err => {
            if (err) {console.error(err);}
        });
    });
    console.log('check numbers.txt');
}

