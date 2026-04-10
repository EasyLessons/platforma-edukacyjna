import Image from 'next/image';

export default function DashboardSection() {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto border-t border-gray-100" id="dashboard">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h2>
        <p className="text-gray-600 text-lg">Zarządzaj swoimi projektami, zespołem oraz tablicami z jednego scentralizowanego miejsca.</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/Workspace.webp" 
              alt="Workspace'y - podgląd" 
              width={800} 
              height={450} 
              className="w-full object-cover"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Workspace'y</h3>
          <p className="text-gray-600 leading-relaxed">Przestrzenie robocze służące do zarządzania poszczególnymi klasami, grupami uczniów lub całymi projektami. Zapraszaj członków zespołu i kontroluj dostęp.</p>
        </div>
        
        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/Tablice.webp" 
              alt="Tablice Workspace'u - podgląd" 
              width={800} 
              height={450} 
              className="w-full object-cover"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Tablice Workspace'u</h3>
          <p className="text-gray-600 leading-relaxed">Pełna lista i podgląd wszystkich wygenerowanych tablic w projekcie. Z łatwością duplikuj, usuwaj i przypisuj do odpowiednich zadań domowych.</p>
        </div>
      </div>
    </section>
  );
}