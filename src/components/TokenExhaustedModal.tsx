import { AlertOctagon, Sparkles, X } from 'lucide-react';

interface TokenExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRedeem: () => void;
}

export function TokenExhaustedModal({ isOpen, onClose, onOpenRedeem }: TokenExhaustedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0D0D11] border border-red-500/20 rounded-2xl p-7 shadow-2xl text-center overflow-hidden">
        {/* Soft cold and red ambient glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-28 bg-red-500/10 blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#A0A0A8] hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertOctagon className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Лимит закончился</h3>
        <p className="text-[#A0A0A8] text-sm mb-6 leading-relaxed">
          Ваш бесплатный лимит 20 000 токенов был использован.
        </p>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-[#A0A0A8] mb-6 text-left space-y-1">
          <p className="text-white font-medium">Как продолжить общение:</p>
          <p>• Введите промокод администратора для моментального пополнения баланса.</p>
          <p>• Обратитесь к администратору для выдачи доступа.</p>
        </div>

        <button
          onClick={() => {
            onClose();
            onOpenRedeem();
          }}
          className="w-full py-3 px-5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/10"
        >
          <Sparkles className="w-4 h-4 text-[#00F0FF]" />
          Получить дополнительные токены
        </button>
      </div>
    </div>
  );
}
