import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Map, MapPin, BusFront, CreditCard, Info, AlertTriangle } from 'lucide-react';
import { guideData } from '../../lib/guideData';

export default function GuideModal({ isOpen, onClose }) {
  const [expandedSection, setExpandedSection] = useState(guideData[0].id);

  if (!isOpen) return null;

  const toggleSection = (id) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  const getSectionIcon = (id) => {
    if (id === 'memahami-peta') return <Map size={20} className="text-blue-500" />;
    if (id === 'mengenal-pemberhentian') return <MapPin size={20} className="text-red-500" />;
    if (id === 'mengenal-layanan') return <BusFront size={20} className="text-emerald-500" />;
    if (id === 'pembayaran') return <CreditCard size={20} className="text-amber-500" />;
    return <Info size={20} className="text-slate-500" />;
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Info className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">Panduan Transjakarta</h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Informasi Peta, Rute, & Layanan</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50/50">
          <div className="flex flex-col gap-4">
            {guideData.map((section) => {
              const isExpanded = expandedSection === section.id;
              
              return (
                <div key={section.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 bg-white hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {getSectionIcon(section.id)}
                      <h3 className="text-base sm:text-xl font-bold text-slate-800">{section.title}</h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 sm:p-6 pt-2 border-t border-slate-100 bg-slate-50/30 flex flex-col mt-4">
                      {section.disclaimer && (
                        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4 text-amber-800 shadow-sm">
                          <AlertTriangle className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                          <p className="text-[13px] sm:text-sm font-medium leading-relaxed">{section.disclaimer}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-8 sm:gap-6">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:gap-6 items-start">
                          {item.image && (
                            <div className="w-full sm:w-2/5 h-auto min-h-[5rem] shrink-0 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-2">
                              <img 
                                src={item.image} 
                                alt={item.title} 
                                className="w-full h-auto object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<span class="text-xs sm:text-sm text-slate-400 font-medium px-2 text-center">Gambar belum tersedia</span>';
                                }}
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-700 text-sm sm:text-lg mb-1 sm:mb-2">{item.title}</h4>
                            <p className="text-xs sm:text-base font-medium text-slate-500 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white text-center">
          <p className="text-xs font-semibold text-slate-400">
            Panduan ini dibuat untuk mempermudah pengalaman navigasi Anda.
          </p>
        </div>

      </div>
    </div>
  );
}
