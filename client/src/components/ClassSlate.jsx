import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { gradeShort } from '../lib/format';

/**
 * A class shown as a small blackboard: the grade is written large in chalk.
 * This is the one bold element in the app; everything around it stays quiet.
 */
export default function ClassSlate({ cls, caption, role, done, onClick }) {
  const { t } = useTranslation();
  const short = gradeShort(cls.grade);
  return (
    <motion.button
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className="chalkboard relative flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-[var(--radius-slate)] border-[3px] border-on-brand p-4 text-left shadow-lift"
    >
      <span className="flex items-start justify-between gap-2 text-[15px] text-chalk/75">
        <span className="truncate">{role || t(`mode.${cls.mode}`)}</span>
        {done && <CheckCircle2 className="size-6 shrink-0 text-chalk" aria-hidden />}
      </span>
      <span className="flex items-baseline gap-2">
        <span className={`font-bold leading-none tracking-tight ${short.length > 3 ? 'text-[40px]' : 'text-[64px]'}`}>{short}</span>
        <span className="text-[28px] font-semibold text-chalk/80">{cls.section}</span>
      </span>
      <span className="flex items-center justify-between gap-2 text-[15px] text-chalk/85">
        <span className="shrink-0">{t('common.students', { count: cls.studentCount })}</span>
        {caption && <span className="truncate">{caption}</span>}
      </span>
      <span className="pointer-events-none absolute right-3 bottom-1 h-1 w-8 rounded-full bg-on-brand/30" />
    </motion.button>
  );
}
