import i18n from '../i18n';

export const gradeLabel = (grade) => (/^\d+$/.test(grade) ? i18n.t('grade.n', { n: grade }) : i18n.t(`grade.${grade}`));
export const classLabel = (c) => (c ? `${gradeLabel(c.grade)} ${c.section}` : '');
// Short form for the slate tile: "4", "LKG".
export const gradeShort = (grade) => (grade === 'PREKG' ? i18n.t('grade.PREKG') : /^\d+$/.test(grade) ? grade : i18n.t(`grade.${grade}`));
export const firstName = (name = '') => name.replace(/^(Sri|Smt|Dr|Mr|Mrs|Ms)\.?\s+/i, '').split(' ')[0];
export const prettyPhone = (p = '') => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);
export const GRADES = ['PREKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
