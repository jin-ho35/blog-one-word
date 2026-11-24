// ==================================================
// 一日一語 ブログ版
// 現在のPWAとは別ファイル・別公開先として使用します。
// Firebaseのデータは現在の一日一語アプリと共有します。
// ==================================================

const firebaseConfig = {
  apiKey: "AIzaSyDu-7ienNoIDNvyNa1xsLyiOE-pNiZs4ac",
  authDomain: "one-word-app-b26d7.firebaseapp.com",
  projectId: "one-word-app-b26d7",
  storageBucket: "one-word-app-b26d7.appspot.com",
  messagingSenderId: "941105888942",
  appId: "1:941105888942:web:26d855d68e6572d0ad773f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let allWords = [];
let miniTalks = [];
let templeAds = [];
let butsuenItems = [];

let currentWord = "";
let currentTalkEntry = null;
let currentTempleEntry = null;
let currentTempleAlignment = null;
let currentButsuenEntry = null;
let currentButsuenAlignment = null;


// --------------------------------------------------
// 日本時間（JST）の日付キー
// 例：2026-11-24
// --------------------------------------------------
function getJapanDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}


// --------------------------------------------------
// 日付から必ず同じ番号を作る
// 「今日の言葉」は全訪問者で同じになります。
// --------------------------------------------------
function dateSeed(dateKey) {
  let hash = 0;

  for (let i = 0; i < dateKey.length; i++) {
    hash = ((hash << 5) - hash) + dateKey.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}


// --------------------------------------------------
// 配列から、その日の項目を選ぶ
// --------------------------------------------------
function pickForToday(items, dateKey, offset = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const index = (dateSeed(dateKey) + offset) % items.length;
  return items[index];
}


// --------------------------------------------------
// 読み込み
// --------------------------------------------------
async function loadData() {
  try {
    // 現在のPWAと同じく匿名認証してからFirestoreを読む
    await firebase.auth().signInAnonymously();

    const [
      wordsSnap,
      templeSnap,
      miniSnap,
      butsuenSnap
    ] = await Promise.all([
      db.collection("sentencesCombined").doc("all").get(),
      db.collection("templeAds").doc("all").get(),
      db.collection("miniTalks").doc("all").get(),
      db.collection("butsuen").doc("all").get()
    ]);

    allWords = wordsSnap.exists ? (wordsSnap.data().texts || []) : [];
    templeAds = templeSnap.exists ? (templeSnap.data().ads || []) : [];
    miniTalks = miniSnap.exists ? (miniSnap.data().talks || []) : [];
    butsuenItems = butsuenSnap.exists ? (butsuenSnap.data().items || []) : [];

    const today = getJapanDateKey();

    // 今日の言葉
    currentWord = pickForToday(allWords, today, 0);

    // 現在のPWAと同じく、miniTalkはtextKeyで対応
    currentTalkEntry = miniTalks.find(t => t.textKey === currentWord) || null;

    // 「お寺の紹介」
    // 現在のアプリでは、ads / alignment が別配列になっている
    // 可能性があるため、同じ日付から対応する位置を選びます。
    currentTempleEntry = pickForToday(templeAds, today, 17);
    if (Array.isArray(templeSnap.data()?.alignment)) {
      const alignment = templeSnap.data().alignment;
      currentTempleAlignment = pickForToday(alignment, today, 17);
    }

    // 「法縁の紹介」
    currentButsuenEntry = pickForToday(butsuenItems, today, 31);
    if (Array.isArray(butsuenSnap.data()?.alignment)) {
      const alignment = butsuenSnap.data().alignment;
      currentButsuenAlignment = pickForToday(alignment, today, 31);
    }

    renderHome();

    document.getElementById("loading").style.display = "none";
    document.getElementById("app").style.display = "block";

  } catch (error) {
    console.error(error);

    document.getElementById("loading").innerHTML = `
      <div>
        <p>読み込みに失敗しました。</p>
        <p style="font-size:13px;color:#777;">
          時間をおいて、もう一度お試しください。
        </p>
      </div>
    `;
  }
}


// --------------------------------------------------
// ひらがなを少し小さく表示
// 現在のPWAの表示方式に合わせています。
// --------------------------------------------------
function shrinkHiragana(text) {
  if (!text) return "";

  return String(text)
    .replace(/([ぁ-んー]+)/g, '<span class="small-hira">$1</span>')
    .replace(/\n/g, "<br>");
}


// --------------------------------------------------
// トップ画面
// --------------------------------------------------
function renderHome() {
  const wordBox = document.getElementById("wordBox");

  if (currentWord) {
    wordBox.innerHTML = shrinkHiragana(currentWord);
  } else {
    wordBox.textContent = "今日の言葉を取得できませんでした。";
  }

  const miniButton = document.getElementById("miniButton");

  if (currentTalkEntry) {
    miniButton.style.display = "block";
  } else {
    miniButton.style.display = "none";
  }
}


// --------------------------------------------------
// 詳細画面を表示
// --------------------------------------------------
function showDetail(title, content) {
  document.getElementById("homeView").classList.remove("active");
  document.getElementById("detailView").classList.add("active");

  document.getElementById("detailTitle").textContent = title;

  const detailContent = document.getElementById("detailContent");

  if (content === null || content === undefined || content === "") {
    detailContent.textContent = "内容がありません。";
  } else {
    // 現在のFirebaseデータにHTMLが含まれている可能性があるため
    // 既存アプリに合わせてinnerHTMLで表示します。
    detailContent.innerHTML = String(content).replace(/\n/g, "<br>");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// --------------------------------------------------
// 今日の言葉に添えて
// --------------------------------------------------
function openMiniTalk() {
  if (!currentTalkEntry) return;

  const content =
    currentTalkEntry.text ||
    currentTalkEntry.talk ||
    currentTalkEntry.content ||
    "";

  showDetail("今日の言葉に添えて", content);
}


// --------------------------------------------------
// 仏門に出遇う
// --------------------------------------------------
function entryToText(entry) {
  if (entry === null || entry === undefined) return "";

  // 現在のアプリで使われている可能性が高い「文字列配列」に対応
  if (typeof entry === "string") {
    return entry;
  }

  // オブジェクト形式にも対応
  return (
    entry.text ||
    entry.content ||
    entry.ad ||
    entry.description ||
    entry.body ||
    entry.name ||
    entry.title ||
    ""
  );
}

function addAlignment(text, alignment) {
  const mainText = entryToText(text);
  const alignText = entryToText(alignment);

  if (!alignText) return mainText;
  if (!mainText) return alignText;

  return `${mainText}<br><br>${alignText}`;
}


// --------------------------------------------------
// お寺の紹介
// --------------------------------------------------
function openTemple() {
  if (!currentTempleEntry) {
    showDetail("お寺の紹介", "内容がありません。");
    return;
  }

  const content = addAlignment(currentTempleEntry, currentTempleAlignment);
  showDetail("お寺の紹介", content);
}


// --------------------------------------------------
// 法縁の紹介
// --------------------------------------------------
function openButsuen() {
  if (!currentButsuenEntry) {
    showDetail("法縁の紹介", "内容がありません。");
    return;
  }

  const content = addAlignment(currentButsuenEntry, currentButsuenAlignment);
  showDetail("法縁の紹介", content);
}


// --------------------------------------------------
// 戻る
// --------------------------------------------------
function goHome() {
  document.getElementById("detailView").classList.remove("active");
  document.getElementById("homeView").classList.add("active");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// --------------------------------------------------
// ボタン
// --------------------------------------------------
document.getElementById("miniButton").addEventListener("click", openMiniTalk);
document.getElementById("templeButton").addEventListener("click", openTemple);
document.getElementById("butsuenButton").addEventListener("click", openButsuen);
document.getElementById("backButton").addEventListener("click", goHome);


// --------------------------------------------------
// 開始
// --------------------------------------------------
loadData();
