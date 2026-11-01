import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readBrowserProfile,saveBrowserProfile} from './profile-store.js';
test('browser profile persists only display fields and handles corrupt or unavailable storage',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  assert.deepEqual(readBrowserProfile(storage),{name:'',bio:''});
  assert.deepEqual(saveBrowserProfile(storage,{name:'  نام نمایشی  ',bio:'طراح\nعلاقه‌مند به برند',email:'never-store@example.test',password:'never-store',id:'not-an-account'}),{name:'نام نمایشی',bio:'طراح\nعلاقه‌مند به برند'});
  assert.deepEqual(readBrowserProfile(storage),{name:'نام نمایشی',bio:'طراح\nعلاقه‌مند به برند'});
  assert.ok(![...data.values()][0].includes('never-store'));assert.ok(![...data.values()][0].includes('not-an-account'));
  const previous=[...data.values()][0];
  for(const invalid of [{name:' ',bio:''},{name:'x'.repeat(81),bio:''},{name:'A\nB',bio:''},{name:'Valid',bio:'x'.repeat(301)},{name:'Valid',bio:null}])assert.throws(()=>saveBrowserProfile(storage,invalid));
  assert.equal([...data.values()][0],previous);
  storage.setItem([...data.keys()][0],'{broken');assert.deepEqual(readBrowserProfile(storage),{name:'',bio:''});
  assert.deepEqual(readBrowserProfile(null),{name:'',bio:''});assert.throws(()=>saveBrowserProfile(null,{name:'Valid',bio:''}),/ذخیره/);
});
