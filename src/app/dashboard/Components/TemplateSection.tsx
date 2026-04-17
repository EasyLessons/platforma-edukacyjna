'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBoard } from '@/_new/features/board/api/boardApi';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type Subject = 'Matematyka' | 'Angielski' | 'Chemia' | 'Fizyka' | 'Biologia';

interface TemplateCard {
  id: string;
  subject: Subject;
  year: number;
  title: string;
  subtitle: string;
  thumbnail: string;
  folder?: string;
}

interface TemplatesSectionProps {
  workspaceId: number | null;
}

const SUBJECTS: Subject[] = ['Matematyka', 'Angielski', 'Chemia', 'Fizyka', 'Biologia'];
const THUMBNAIL_PLACEHOLDER =
  'https://cdn.galleries.smcloud.net/t/galleries/gf-7PXx-FHuo-BEQW_matura-2024-arkusz-cke-z-matematyki-pp-nowa-formula-1248x1040.jpg';

const THUMBNAILS = {
  mp2025: '/arkusze/matura-podstawowa/2025/glowna/2025MP.webp',
  mp2024: '/arkusze/matura-podstawowa/2024/glowna/2024MP.webp',
  mr2025: '/arkusze/matura-rozszerzona/2025/glowna/2025MR.webp',
  mr2024: '/arkusze/matura-rozszerzona/2024/glowna/2024MR.webp',
  e82025: '/arkusze/egzamin-8/2025/glowny/2025E8.webp',
  e82024: '/arkusze/egzamin-8/2024/glowny/2024E8.webp',
  whiteboard: '/arkusze/pustyWhiteboardTemplate/whiteboard.webp',
} as const;

const TEMPLATE_CARDS: TemplateCard[] = [
  {
    id: 'mpp-2025-main',
    subject: 'Matematyka',
    year: 2025,
    title: 'Matura podstawowa 2025',
    subtitle: 'Matura glowna (maj)',
    thumbnail: THUMBNAILS.mp2025,
    folder: '/arkusze/matura-podstawowa/2025/glowna',
  },
  {
    id: 'mpp-2025-extra',
    subject: 'Matematyka',
    year: 2025,
    title: 'Matura podstawowa 2025',
    subtitle: 'Matura dodatkowa (czerwiec)',
    thumbnail: THUMBNAILS.mp2025,
    folder: '/arkusze/matura-podstawowa/2025/dodatkowa',
  },
  {
    id: 'mpp-2024-main',
    subject: 'Matematyka',
    year: 2024,
    title: 'Matura podstawowa 2024',
    subtitle: 'Matura glowna (maj)',
    thumbnail: THUMBNAILS.mp2024,
    folder: '/arkusze/matura-podstawowa/2024/glowna',
  },
  {
    id: 'mpr-2025-main',
    subject: 'Matematyka',
    year: 2025,
    title: 'Matura rozszerzona 2025',
    subtitle: 'Matura glowna (maj)',
    thumbnail: THUMBNAILS.mr2025,
    folder: '/arkusze/matura-rozszerzona/2025/glowna',
  },
  {
    id: 'mpr-2024-main',
    subject: 'Matematyka',
    year: 2024,
    title: 'Matura rozszerzona 2024',
    subtitle: 'Matura glowna (maj)',
    thumbnail: THUMBNAILS.mr2024,
    folder: '/arkusze/matura-rozszerzona/2024/glowna',
  },
  {
    id: 'egz8-2025-main',
    subject: 'Matematyka',
    year: 2025,
    title: 'Egzamin 8-klasisty 2025',
    subtitle: 'Arkusz glowny',
    thumbnail: THUMBNAILS.e82025,
    folder: '/arkusze/egzamin-8/2025/glowny',
  },
  {
    id: 'egz8-2024-main',
    subject: 'Matematyka',
    year: 2024,
    title: 'Egzamin 8-klasisty 2024',
    subtitle: 'Arkusz glowny',
    thumbnail: THUMBNAILS.e82024,
    folder: '/arkusze/egzamin-8/2024/glowny',
  },
];

export default function TemplatesSection({ workspaceId }: TemplatesSectionProps) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subject, setSubject] = useState<Subject>('Matematyka');
  const [yearOpen, setYearOpen] = useState(false);

  const yearsForSubject = useMemo(() => {
    const years = TEMPLATE_CARDS.filter((item) => item.subject === subject)
      .map((item) => item.year)
      .filter((year, idx, arr) => arr.indexOf(year) === idx)
      .sort((a, b) => b - a);

    return years;
  }, [subject]);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const effectiveYear = selectedYear ?? yearsForSubject[0] ?? null;

  const templates = useMemo(() => {
    return TEMPLATE_CARDS.filter(
      (item) => item.subject === subject && (effectiveYear ? item.year === effectiveYear : true)
    );
  }, [subject, effectiveYear]);

  const scrollByCards = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const amount = direction === 'left' ? -320 : 320;
    scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const createAndOpenBoard = async (name: string, folder?: string) => {
    if (!workspaceId) return;

    try {
      const newBoard = await createBoard({
        name,
        workspace_id: workspaceId,
        icon: 'FileText',
        bg_color: 'green-500',
      });

      const route = folder
        ? `/tablica?boardId=${newBoard.id}&arkusz=${encodeURIComponent(folder)}`
        : `/tablica?boardId=${newBoard.id}`;

      router.push(route);
    } catch (error) {
      console.error('Blad tworzenia tablicy:', error);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(target)) {
        setSubjectOpen(false);
      }

      if (yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
        setYearOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <section className="mb-8 rounded-3xl bg-[#ffffff] border border-[var(--dash-border)] p-4 sm:p-5">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <h2 className="text-2xl md:text-[28px] font-bold text-gray-900 ml-3 mb-2">Szablony</h2>
          
          <div className="flex items-center gap-2">
            <div className="relative" ref={subjectDropdownRef}>
            <button
              onClick={() => {
                setSubjectOpen((prev) => !prev);
                setYearOpen(false);
              }}
              className="dashboard-soft-panel-no-border flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 my-auto">Zestaw szablonow:</span>
              <span className="font-medium text-gray-900">{subject}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${subjectOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {subjectOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] animate-in slide-in-from-top-1 fade-in zoom-in-95 duration-150 ease-out rounded-xl bg-white py-1 shadow-md">
                {SUBJECTS.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setSubject(item);
                      setSubjectOpen(false);
                      setSelectedYear(null);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[#ececef] hover:cursor-pointer ${
                      item === subject ? 'text-black font-medium' : 'text-gray-700'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={yearDropdownRef}>
            <button
              onClick={() => {
                setYearOpen((prev) => !prev);
                setSubjectOpen(false);
              }}
              className="dashboard-soft-panel-no-border flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Rok:</span>
              <span className="font-medium text-gray-900">{effectiveYear ?? 'Wszystkie'}</span>
              <ChevronDown size={14} className={`transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
            </button>

            {yearOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[130px] animate-in slide-in-from-top-1 fade-in zoom-in-95 duration-150 ease-out rounded-xl bg-white py-1 shadow-md">
                {yearsForSubject.map((year) => (
                  <button
                    key={year}
                    onClick={() => {
                      setSelectedYear(year);
                      setYearOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[#ececef] hover:cursor-pointer ${
                      year === effectiveYear ? 'text-black font-medium' : 'text-gray-700'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <button
            onClick={() => scrollByCards('left')}
            className="dashboard-soft-panel p-1.5 text-gray-600 hover:bg-[#ececef]"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scrollByCards('right')}
            className="dashboard-soft-panel p-1.5 text-gray-600 hover:bg-[#ececef]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => createAndOpenBoard('Czysta tablica')}
          className="dashboard-hover-surface group relative w-[280px] flex-shrink-0 p-2.5 text-left hover:cursor-pointer"
        >
          <div className="relative mb-3 aspect-video overflow-hidden rounded-xl bg-white border border-dashed border-gray-300 flex items-center justify-center">
            <img src={THUMBNAILS.whiteboard} alt="Czysta tablica" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#212224] text-white shadow-md">
                <Plus size={18} />
              </div>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-900">Czysta tablica</p>
          <p className="text-xs text-gray-500">Nowa pusta przestrzen robocza</p>
        </button>

        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => createAndOpenBoard(`${template.title} - ${template.subtitle}`, template.folder)}
            className="dashboard-hover-surface group relative w-[280px] flex-shrink-0 p-2.5 text-left hover:cursor-pointer"
          >
            <div className="relative mb-3 aspect-video overflow-hidden rounded-xl bg-white">
              <img src={template.thumbnail} alt={template.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#212224] text-white shadow-md">
                  <Plus size={18} />
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900">{template.title}</p>
            <p className="mt-1 text-xs text-gray-500">
              {template.subtitle} {template.year ? `• ${template.year}` : ''}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
