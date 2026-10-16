const { Notification } = require('../models');
const { sendPush } = require('./push');

const REASON_WORDS = {
  kn: { sick: 'ಅನಾರೋಗ್ಯ', family: 'ಕುಟುಂಬದ ಕಾರಣ', travel: 'ಪ್ರಯಾಣ', other: 'ಇತರೆ' },
  en: { sick: 'Sick', family: 'Family reason', travel: 'Travelling', other: 'Other' },
  hi: { sick: 'बीमार', family: 'पारिवारिक कारण', travel: 'यात्रा', other: 'अन्य' },
};
const withNote = (word, note) => (note ? `${word}: ${note}` : word);

/**
 * Builds the words for each notification in the person's language.
 * Short on purpose: it is read on a lock screen.
 */
const TEXT = {
  absent: {
    kn: (p) => [`${p.studentName} ಇಂದು ಗೈರು`, `${p.className}. ಕಾರಣ ತಿಳಿಸಲು ಸ್ಪರ್ಶಿಸಿ.`],
    en: (p) => [`${p.studentName} is absent today`, `${p.className}. Tap to tell the teacher why.`],
    hi: (p) => [`${p.studentName} आज अनुपस्थित है`, `${p.className}। कारण बताने के लिए टैप करें।`],
  },
  absent_cleared: {
    kn: (p) => [`${p.studentName} ಶಾಲೆಯಲ್ಲಿದ್ದಾರೆ`, 'ಶಿಕ್ಷಕರು ಹಾಜರಾತಿ ಸರಿಪಡಿಸಿದ್ದಾರೆ.'],
    en: (p) => [`${p.studentName} is in school`, 'The teacher corrected today’s attendance.'],
    hi: (p) => [`${p.studentName} स्कूल में है`, 'शिक्षक ने आज की हाज़िरी ठीक कर दी है।'],
  },
  picked_up: {
    kn: (p) => [`${p.studentName} ಅವರನ್ನು ಕರೆದೊಯ್ಯಲಾಗಿದೆ`, `${p.by} (${p.relation}), ${p.time}`],
    en: (p) => [`${p.studentName} was picked up`, `By ${p.by} (${p.relation}) at ${p.time}`],
    hi: (p) => [`${p.studentName} को ले जाया गया`, `${p.by} (${p.relation}) द्वारा, ${p.time}`],
  },
  late_pickup: {
    kn: (p) => ['ಮಗು ಇನ್ನೂ ಕಾಯುತ್ತಿದೆ', `${p.studentName}, ${p.className}. ${p.minutes} ನಿಮಿಷ ತಡ.`],
    en: (p) => ['A child is still waiting', `${p.studentName}, ${p.className}. ${p.minutes} minutes past pickup time.`],
    hi: (p) => ['बच्चा अभी भी इंतज़ार कर रहा है', `${p.studentName}, ${p.className}. ${p.minutes} मिनट देर।`],
  },
  leave_request: {
    kn: (p) => ['ರಜೆ ಅರ್ಜಿ', `${p.studentName}: ${p.from} – ${p.to}`],
    en: (p) => ['Leave request', `${p.studentName}: ${p.from} – ${p.to}`],
    hi: (p) => ['छुट्टी का आवेदन', `${p.studentName}: ${p.from} – ${p.to}`],
  },
  leave_decision: {
    kn: (p) => [p.approved ? 'ರಜೆ ಮಂಜೂರಾಗಿದೆ' : 'ರಜೆ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ', `${p.studentName}: ${p.from} – ${p.to}`],
    en: (p) => [p.approved ? 'Leave approved' : 'Leave not approved', `${p.studentName}: ${p.from} – ${p.to}`],
    hi: (p) => [p.approved ? 'छुट्टी मंज़ूर' : 'छुट्टी नामंज़ूर', `${p.studentName}: ${p.from} – ${p.to}`],
  },
  absence_reason: {
    kn: (p) => [`${p.studentName}: ಪೋಷಕರ ಉತ್ತರ`, withNote(REASON_WORDS.kn[p.code], p.note)],
    en: (p) => [`${p.studentName}: parent replied`, withNote(REASON_WORDS.en[p.code], p.note)],
    hi: (p) => [`${p.studentName}: अभिभावक का जवाब`, withNote(REASON_WORDS.hi[p.code], p.note)],
  },
};

/**
 * Stores an in-app notification and pushes it to the person's phones.
 * SMS/WhatsApp would plug in here (e.g. MSG91) for parents without smartphones.
 */
async function notify(user, type, payload, { url, actions, replyToken } = {}) {
  const lang = TEXT[type][user.language] ? user.language : 'en';
  const [title, body] = TEXT[type][lang](payload);
  const note = await Notification.create({
    schoolId: user.schoolId, userId: user._id, type, payload: { ...payload, title, body, url }, channels: ['inapp'],
  });
  const pushed = await sendPush(user._id, { title, body, url, tag: `${type}:${payload.key || note._id}`, actions, replyToken, id: String(note._id) });
  if (pushed) { note.channels.push('push'); await note.save(); }
  return note;
}

module.exports = { notify, TEXT };
