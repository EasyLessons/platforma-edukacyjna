import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { fetchUserAssets, deleteUserAsset } from '../../api/assets-api';
import { SavedAsset } from '../../types/assets';

interface SavedAssetsPanelProps {
    onClose: () => void;
    refreshKey?: number;
}

export const SavedAssetsPanel = ({ onClose, refreshKey }: SavedAssetsPanelProps) => {
    const [assets, setAssets] = useState<SavedAsset[]>([]);

    useEffect(() => {
        fetchUserAssets().then(setAssets).catch(console.error);
    }, [refreshKey]);

    const handleDelete = async (id: number) => {
        if(!confirm("Na pewno usunąć ten szablon?")) return;
        try {
            await deleteUserAsset(id);
            setAssets(prev => prev.filter(a => a.id !== id));
        } catch(e) { console.error(e) }
    };

    return (
        <div className="w-64 h-full bg-white border-l shadow-sm overflow-y-auto flex flex-col p-4 z-50 fixed right-0 top-16">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-black">Moje Szablony</h3>
                <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                    <X size={16} />
                </button>
            </div>
            
            <div className="flex flex-col gap-4">
                {assets.map(asset => (
                    <div 
                        key={asset.id} 
                        draggable 
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/x-whiteboard-asset', JSON.stringify(asset.elements_data));
                        }}
                        className="group relative border rounded shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing pb-1 overflow-hidden"
                    >
                        {/* Renderer SVG miniatury (niebezpieczne html pozwala użyć surowego kodu w zgenerowanej wersji powłoki) */}
                        <div className="w-full h-32 bg-gray-50 flex items-center justify-center p-2 mb-2" dangerouslySetInnerHTML={{ __html: asset.thumbnail || '' }} />
                        
                        <p className="px-2 text-sm font-semibold text-gray-800 line-clamp-1 truncate">{asset.name}</p>
                        
                        <button 
                            onClick={() => handleDelete(asset.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                
                {assets.length === 0 && (
                    <p className="text-xs text-gray-500 mt-10 text-center">Nie masz jeszcze żadnych szablonów. Kliknij 'Zapisz jako szablon' w menu właściwości dowolnej grupy.</p>
                )}
            </div>
        </div>
    )
};
