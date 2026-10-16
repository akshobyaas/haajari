import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

export const useToast = create((set) => ({
  message: null,
  show: (message) => {
    set({ message });
    clearTimeout(useToast.timer);
    useToast.timer = setTimeout(() => set({ message: null }), 2600);
  },
}));

export default function Toaster() {
  const message = useToast((s) => s.message);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-paper shadow-lift">
            <CheckCircle2 className="size-5 text-present" /> {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
