function leftPadTwoZeros(someString: string) {
  return ('00' + someString).slice(-2);
}

export function getTimeStamp() {
  let date = new Date();
  return [
    date.getFullYear(),
    leftPadTwoZeros((date.getMonth() + 1).toString()),
    leftPadTwoZeros(date.getDate().toString()),
    leftPadTwoZeros(date.getHours().toString()),
    leftPadTwoZeros(date.getMinutes().toString()),
    leftPadTwoZeros(date.getSeconds().toString()),
  ].join('-');
}
