import React from 'react';
import { Card } from '../UI';
import { CreditCard, Calendar, Check, X } from 'lucide-react';

export interface ActivityItem {
    id: string;
    type: 'SALE' | 'APPOINTMENT' | 'CANCELLATION';
    title: string;
    subtitle: string;
    time: string;
    amount?: number;
    status?: string;
}

interface ActivityFeedProps {
    activities: ActivityItem[];
    title?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, title = "Recent Activity" }) => {

    // Sort activities by time (assuming they might come mixed) or just display as is
    // For a timeline, usually we want latest first. Assuming passed prop is already sorted or we rely on it.

    const getIcon = (type: string) => {
        switch (type) {
            case 'SALE': return <CreditCard size={16} className="text-white" />;
            case 'APPOINTMENT': return <Calendar size={16} className="text-white" />;
            case 'CANCELLATION': return <X size={16} className="text-white" />;
            default: return <Check size={16} className="text-white" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'SALE': return 'bg-emerald-500 shadow-emerald-200';
            case 'APPOINTMENT': return 'bg-violet-500 shadow-violet-200';
            case 'CANCELLATION': return 'bg-rose-500 shadow-rose-200';
            default: return 'bg-slate-400 shadow-slate-200';
        }
    };

    return (
        <Card title={title}>
            <div className="relative space-y-0 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                {activities.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                            <Calendar className="text-black" size={24} />
                        </div>
                        <p className="text-sm font-medium text-black">No recent activity</p>
                    </div>
                ) : (
                    activities.map((item, index) => (
                        <div key={item.id} className="relative pl-10 pb-6 last:pb-0 group">
                            {/* Vertical Line */}
                            {index !== activities.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-slate-200 group-last:hidden"></div>
                            )}

                            {/* Icon Bubble */}
                            <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center shadow-md ring-2 ring-white z-10 ${getBgColor(item.type)}`}>
                                {getIcon(item.type)}
                            </div>

                            {/* Content Card */}
                            <div className="bg-white rounded-lg p-3 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 shadow-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm font-bold ${item.type === 'SALE' ? 'text-emerald-700' : 'text-black'}`}>
                                        {item.title}
                                    </h4>
                                    <span className="text-[10px] font-semibold text-black bg-slate-100 px-2 py-0.5 rounded-full">
                                        {item.time}
                                    </span>
                                </div>

                                <p className="text-xs text-black mb-2 font-medium">
                                    {item.subtitle}
                                </p>

                                <div className="flex items-center gap-2">
                                    {item.amount && (
                                        <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                            <CreditCard size={10} />
                                            +₹{item.amount.toLocaleString()}
                                        </div>
                                    )}

                                    {item.status && (
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md border
                                            ${item.status === 'CONFIRMED' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                                                item.status === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-100' :
                                                    item.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        'bg-slate-50 text-black border-slate-100'}`}>
                                            {item.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};
