import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ArrowLeft, Hourglass } from 'lucide-react';
import BoardHeader from '../components/layout/BoardHeader';
import SchoolForm from '../components/schools/SchoolForm';
import { platformApi } from '../api/platform';

// Public page: a headmaster asks to put their school on Haajari; the block office approves it.
export default function RegisterSchool() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(null);
  return (
    <div className="min-h-dvh bg-paper">
      <BoardHeader />
      <main className="relative mx-auto -mt-8 max-w-md px-4 pb-10">
        <div className="rounded-3xl bg-card p-5 shadow-lift">
          {sent ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-4 text-center" role="status">
              <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-accent text-on-brand"><Hourglass className="size-8" aria-hidden /></span>
              <h1 className="text-2xl font-bold">{t('register.sentTitle')}</h1>
              <p className="mt-2 text-muted">{t('register.sentBody', { name: sent.name, email: sent.email })}</p>
              <Link to="/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-board px-5 font-semibold text-chalk">{t('register.backToLogin')}</Link>
            </motion.div>
          ) : (
            <>
              <Link to="/login" className="mb-3 inline-flex items-center gap-1 text-[15px] text-muted hover:text-board-text">
                <ArrowLeft className="size-4" aria-hidden /> {t('register.backToLogin')}
              </Link>
              <h1 className="text-2xl font-bold">{t('register.title')}</h1>
              <p className="mt-1 mb-6 text-muted">{t('register.sub')}</p>
              <SchoolForm
                submitLabel={t('register.submit')}
                onSubmit={async (body) => {
                  await platformApi.requestSchool(body);
                  setSent({ name: body.school.name, email: body.hm.email });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
