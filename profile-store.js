// Device-only display preferences. This never creates an authenticated account.
const key='mehrad-browser-profile-v1';
export function validateBrowserProfile(value){
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||/[\x00-\x1f\x7f]/.test(value.name))throw Error('نام نمایشی باید ۱ تا ۸۰ کاراکتر و بدون خط جدید باشد.');
  if(typeof value.bio!=='string'||value.bio.length>300||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.bio))throw Error('معرفی کوتاه باید حداکثر ۳۰۰ کاراکتر باشد.');
  return {name:value.name.trim(),bio:value.bio.trim()};
}
export function readBrowserProfile(storage){
  try{return validateBrowserProfile(JSON.parse(storage.getItem(key)));}
  catch{return {name:'',bio:''};}
}
export function saveBrowserProfile(storage,value){
  const profile=validateBrowserProfile(value);
  try{storage.setItem(key,JSON.stringify(profile));}
  catch{throw Error('ذخیره در این مرورگر در دسترس نیست. تنظیمات فضای ذخیره‌سازی را بررسی کنید و دوباره تلاش کنید.');}
  return profile;
}
