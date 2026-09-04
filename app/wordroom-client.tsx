'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Layers3,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  LABELS as labels,
  SAMPLE_WORDS as sample,
  createStarredCSV,
  createWords,
  detectMapping,
  parseCSV,
  shuffled as shuffle,
} from '@/wordroom.js';
import type { Field, Mapping, Word } from '@/wordroom.js';

type WordInput = Omit<Word, 'sourceIndex'>;

export default function WordroomClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [words, setWords] = useState<Word[]>(sample);
  const [fileName, setFileName] = useState('示例词库.csv');
  const [headers, setHeaders] = useState([
    'word',
    'meaning',
    'example',
    'phrase',
  ]);
  const [sourceHeaders, setSourceHeaders] = useState([
    'word',
    'meaning',
    'example',
    'phrase',
  ]);
  const [rawRows, setRawRows] = useState(
    sample.map((w) => [w.word, w.meaning!, w.example!, w.phrase!]),
  );
  const [mapping, setMapping] = useState<Mapping>({
    word: 0,
    meaning: 1,
    example: 2,
    phrase: 3,
  });
  const [included, setIncluded] = useState({
    meaning: true,
    example: true,
    phrase: true,
  });
  const [mode, setMode] = useState<'cards' | 'draw'>('cards');
  const [deck, setDeck] = useState(() => shuffle(sample));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [drawCount, setDrawCount] = useState(3);
  const [drawn, setDrawn] = useState(sample.slice(0, 3));
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [starred, setStarred] = useState<Set<number>>(() => new Set());

  const replaceWords = (mapped: Word[]) => {
    setWords(mapped);
    setDeck(shuffle(mapped));
    setIndex(0);
    setFlipped(false);
    setDrawCount(mapped.length ? Math.min(3, mapped.length) : 1);
    setDrawn(mapped.slice(0, Math.min(3, mapped.length)));
    setAnswers({});
  };
  const applyMapping = (next: Mapping) => {
    const mapped = createWords(rawRows, next);
    const validSourceIndices = new Set(mapped.map((item) => item.sourceIndex));
    setStarred(
      (currentStars) =>
        new Set(
          [...currentStars].filter((sourceIndex) =>
            validSourceIndices.has(sourceIndex),
          ),
        ),
    );
    replaceWords(mapped);
    setMessage(mapped.length ? '' : '所选“单词”列中没有有效内容');
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    setMessage('');
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('文件超过 5 MB，请缩小后重试');
      if (!file.name.toLowerCase().endsWith('.csv'))
        throw new Error('请选择 .csv 文件');
      const rows = parseCSV(await file.text());
      if (rows.length < 2) throw new Error('CSV 至少需要一行列名和一行单词');
      const next = detectMapping(rows[0]);
      const data = rows.slice(1);
      const mapped = createWords(data, next);
      setFileName(file.name);
      setSourceHeaders(rows[0]);
      setHeaders(rows[0].map((header, i) => header || `第 ${i + 1} 列`));
      setRawRows(data);
      setMapping(next);
      setIncluded({
        meaning: next.meaning != null,
        example: next.example != null,
        phrase: next.phrase != null,
      });
      setStarred(new Set());
      replaceWords(mapped);
      if (!mapped.length) setMessage('所选“单词”列中没有有效内容');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '无法读取这个 CSV 文件',
      );
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const current = deck[index],
    progress = deck.length ? ((index + 1) / deck.length) * 100 : 0;
  const optionalFields = useMemo(
    () =>
      (['meaning', 'example', 'phrase'] as const).filter((k) => included[k]),
    [included],
  );
  const reshuffle = () => {
    setDeck(shuffle(words));
    setIndex(0);
    setFlipped(false);
  };
  const draw = () => {
    setDrawn(shuffle(words).slice(0, Math.min(drawCount, words.length)));
    setAnswers({});
  };
  const toggleStar = (sourceIndex: number) => {
    setStarred((currentStars) => {
      const next = new Set(currentStars);
      if (next.has(sourceIndex)) next.delete(sourceIndex);
      else next.add(sourceIndex);
      return next;
    });
  };
  const exportStarred = () => {
    if (!starred.size) return;
    const csv = createStarredCSV(sourceHeaders, rawRows, starred);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = fileName.replace(/\.csv$/i, '') || 'wordroom';
    link.href = url;
    link.download = `${baseName}-星标.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Record<string, unknown>,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Record<string, unknown>) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {}
    };
    register({
      name: 'set_word_list',
      title: '设置词表',
      description: '用结构化数据替换当前词表，并更新页面中的复习卡片。',
      inputSchema: {
        type: 'object',
        properties: {
          words: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                word: { type: 'string', minLength: 1 },
                meaning: { type: 'string' },
                example: { type: 'string' },
                phrase: { type: 'string' },
              },
              required: ['word'],
              additionalProperties: false,
            },
          },
        },
        required: ['words'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        const list = (input as { words?: WordInput[] }).words;
        if (
          !Array.isArray(list) ||
          !list.length ||
          list.some(
            (item) =>
              !item || typeof item.word !== 'string' || !item.word.trim(),
          )
        )
          throw new Error('words 必须是至少包含一个有效单词的数组');
        const clean: Word[] = list.map((item, sourceIndex) => ({
          ...item,
          sourceIndex,
          word: item.word.trim(),
        }));
        const importedHeaders = ['word', 'meaning', 'example', 'phrase'];
        const importedRows = clean.map((item) => [
          item.word,
          item.meaning ?? '',
          item.example ?? '',
          item.phrase ?? '',
        ]);
        setWords(clean);
        setDeck(shuffle(clean));
        setIndex(0);
        setFlipped(false);
        setDrawn(clean.slice(0, Math.min(3, clean.length)));
        setDrawCount(Math.min(3, clean.length));
        setFileName('自动导入的词表');
        setHeaders(importedHeaders);
        setSourceHeaders(importedHeaders);
        setRawRows(importedRows);
        setMapping({ word: 0, meaning: 1, example: 2, phrase: 3 });
        setIncluded({ meaning: true, example: true, phrase: true });
        setStarred(new Set());
        return { count: clean.length };
      },
    });
    register({
      name: 'shuffle_flashcards',
      title: '重新洗牌',
      description: '随机排列当前词表，并从第一张卡片开始复习。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        const next = shuffle(words);
        setDeck(next);
        setIndex(0);
        setFlipped(false);
        setMode('cards');
        return { count: next.length, firstWord: next[0]?.word ?? null };
      },
    });
    register({
      name: 'draw_words_for_practice',
      title: '抽词练习',
      description: '从当前词表随机抽取指定数量的词，并打开造句练习。',
      inputSchema: {
        type: 'object',
        properties: { count: { type: 'integer', minimum: 1 } },
        required: ['count'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const count = (input as { count?: number }).count;
        if (
          !Number.isInteger(count) ||
          !count ||
          count < 1 ||
          count > words.length
        )
          throw new Error(`count 必须是 1 到 ${words.length} 之间的整数`);
        const next = shuffle(words).slice(0, count);
        setDrawCount(count);
        setDrawn(next);
        setAnswers({});
        setMode('draw');
        return { count: next.length, words: next.map((item) => item.word) };
      },
    });
    return () => lifecycle.abort();
  }, [words]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                词间 · Wordroom
              </h1>
              <p className="text-xs text-muted-foreground">
                把你的词表，变成今天的练习
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="rounded-full border bg-muted px-3 py-1.5 text-sm font-medium">
              {words.length} 个单词
            </div>
            <Button
              variant="outline"
              disabled={!starred.size}
              onClick={exportStarred}
              aria-label={`导出 ${starred.size} 个星标单词`}
            >
              <Download />
              导出星标（{starred.size}）
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-10">
        <aside className="space-y-5">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FileSpreadsheet className="text-primary" size={19} />
              <h2 className="font-semibold">导入词表</h2>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void loadFile(e.dataTransfer.files[0]);
              }}
              className={`group flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${dragging ? 'border-primary bg-accent' : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/60'}`}
            >
              <div className="mb-3 grid size-11 place-items-center rounded-full bg-card shadow-sm">
                <Upload size={19} />
              </div>
              <span className="text-sm font-semibold">拖入 CSV 文件</span>
              <span className="mt-1 text-xs text-muted-foreground">
                或点击选择 · 首行为列名
              </span>
            </button>
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                void loadFile(e.target.files?.[0]);
              }}
            />
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm">
              <Check size={15} className="text-primary" />
              <span className="min-w-0 flex-1 truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground">已载入</span>
            </div>
            <output
              className="mt-2 min-h-5 text-xs text-destructive"
              aria-live="polite"
            >
              {message}
            </output>
          </section>
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">CSV 里有什么？</h2>
            <p className="mb-4 text-xs leading-5 text-muted-foreground">
              勾选文件包含的内容，再指定对应列。单词为必选。
            </p>
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Checkbox checked disabled />
                <span>单词（必选）</span>
              </div>
              {(['meaning', 'example', 'phrase'] as const).map((field) => (
                <label
                  key={field}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={included[field]}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      const used = new Set(
                        Object.values(mapping).filter(Number.isInteger),
                      );
                      const available = headers.findIndex(
                        (_, candidate) => !used.has(candidate),
                      );
                      if (on && mapping[field] == null && available < 0) {
                        setMessage('没有剩余的 CSV 列可供映射');
                        return;
                      }
                      const next: Mapping = {
                        ...mapping,
                        [field]: on ? (mapping[field] ?? available) : null,
                      };
                      setMessage('');
                      setIncluded((v) => ({ ...v, [field]: on }));
                      setMapping(next);
                      applyMapping(next);
                    }}
                  />
                  <span>{labels[field]}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3">
              {(['word', 'meaning', 'example', 'phrase'] as Field[])
                .filter((field) => field === 'word' || included[field])
                .map((field) => (
                  <div
                    key={field}
                    className="grid grid-cols-[78px_1fr] items-center gap-3"
                  >
                    <label className="text-sm font-medium">
                      {labels[field]}
                      {field === 'word' && (
                        <span className="text-primary"> *</span>
                      )}
                    </label>
                    <Select
                      value={String(mapping[field] ?? 0)}
                      onValueChange={(value) => {
                        const next = { ...mapping, [field]: Number(value) };
                        setMapping(next);
                        applyMapping(next);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((h, i) => (
                          <SelectItem
                            key={`${h}-${i}`}
                            value={String(i)}
                            disabled={Object.entries(mapping).some(
                              ([other, selected]) =>
                                other !== field && selected === i,
                            )}
                          >
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
            </div>
          </section>
        </aside>
        <section className="min-w-0 rounded-[2rem] border bg-card p-4 shadow-sm sm:p-7 lg:p-9">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-xl bg-muted p-1">
              <button
                onClick={() => setMode('cards')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === 'cards' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Layers3 className="mr-2 inline" size={16} />
                随机卡片
              </button>
              <button
                onClick={() => setMode('draw')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === 'draw' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Shuffle className="mr-2 inline" size={16} />
                抽词练习
              </button>
            </div>
            {mode === 'cards' && (
              <Button variant="outline" size="lg" onClick={reshuffle}>
                <Shuffle />
                重新洗牌
              </Button>
            )}
          </div>
          {mode === 'cards' ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-medium">今日复习</span>
                <span className="text-muted-foreground">
                  {deck.length ? index + 1 : 0} / {deck.length}
                </span>
              </div>
              <Progress value={progress} className="mb-6" />
              {current ? (
                <div className="relative">
                  <button
                    onClick={() => setFlipped(!flipped)}
                    className="group relative flex min-h-[390px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border bg-card px-8 py-12 text-center shadow-[0_20px_60px_-30px_rgba(30,64,55,.45)] transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <div className="absolute inset-x-0 top-0 h-2 bg-primary" />
                    <span className="mb-5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                      {flipped ? '答案' : '点击翻面'}
                    </span>
                    <h2 className="font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
                      {current.word}
                    </h2>
                    {flipped ? (
                      <div className="mt-8 w-full max-w-xl space-y-5 text-left">
                        {optionalFields.map(
                          (field) =>
                            current[field] && (
                              <div
                                key={field}
                                className="grid grid-cols-[64px_1fr] gap-4 border-t pt-4"
                              >
                                <span className="text-sm font-semibold text-primary">
                                  {labels[field]}
                                </span>
                                <span className="text-base leading-7">
                                  {current[field]}
                                </span>
                              </div>
                            ),
                        )}
                      </div>
                    ) : (
                      <p className="mt-6 text-sm text-muted-foreground">
                        先在心里回忆，再查看答案
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`absolute right-5 top-5 z-10 grid size-11 place-items-center rounded-full border bg-card text-amber-600 shadow-sm transition hover:scale-105 ${starred.has(current.sourceIndex) ? 'border-amber-400 bg-amber-50' : ''}`}
                    onClick={() => toggleStar(current.sourceIndex)}
                    aria-pressed={starred.has(current.sourceIndex)}
                    aria-label={`${starred.has(current.sourceIndex) ? '取消' : '给'} ${current.word} ${starred.has(current.sourceIndex) ? '的星标' : '加星标'}`}
                  >
                    <Star
                      size={22}
                      fill={
                        starred.has(current.sourceIndex)
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                  </button>
                </div>
              ) : (
                <div className="grid min-h-[390px] place-items-center rounded-[2rem] border border-dashed text-muted-foreground">
                  请导入包含单词的 CSV 文件
                </div>
              )}
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={index === 0}
                  onClick={() => {
                    setIndex((i) => i - 1);
                    setFlipped(false);
                  }}
                >
                  <ArrowLeft />
                  上一个
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setFlipped(!flipped)}
                >
                  <RotateCcw />
                  翻面
                </Button>
                <Button
                  size="lg"
                  disabled={index >= deck.length - 1}
                  onClick={() => {
                    setIndex((i) => i + 1);
                    setFlipped(false);
                  }}
                >
                  下一个
                  <ArrowRight />
                </Button>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                点击卡片翻面 · 每次洗牌都会生成新的顺序
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-accent p-5">
                <div>
                  <h2 className="font-semibold">随机抽取一组词</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    不看答案，试着为每个词写一个自己的例句。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm font-medium" htmlFor="draw-count">
                    抽取
                  </label>
                  <input
                    id="draw-count"
                    className="h-10 w-20 rounded-lg border bg-card px-3 text-center font-semibold outline-none focus:ring-2 focus:ring-ring"
                    type="number"
                    min={1}
                    max={Math.max(1, words.length)}
                    value={drawCount}
                    onChange={(e) =>
                      setDrawCount(
                        Math.max(
                          1,
                          Math.min(words.length, Number(e.target.value)),
                        ),
                      )
                    }
                  />
                  <span className="text-sm">个词</span>
                  <Button size="lg" onClick={draw}>
                    <Shuffle />
                    重新抽取
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {drawn.map((word, i) => (
                  <article
                    key={word.sourceIndex}
                    className="rounded-2xl border bg-background p-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <span className="mr-3 text-xs font-semibold text-primary">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <strong className="font-serif text-2xl">
                          {word.word}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className={`grid size-10 shrink-0 place-items-center rounded-full border bg-card text-amber-600 transition hover:scale-105 ${starred.has(word.sourceIndex) ? 'border-amber-400 bg-amber-50' : ''}`}
                        onClick={() => toggleStar(word.sourceIndex)}
                        aria-pressed={starred.has(word.sourceIndex)}
                        aria-label={`${starred.has(word.sourceIndex) ? '取消' : '给'} ${word.word} ${starred.has(word.sourceIndex) ? '的星标' : '加星标'}`}
                      >
                        <Star
                          size={20}
                          fill={
                            starred.has(word.sourceIndex)
                              ? 'currentColor'
                              : 'none'
                          }
                        />
                      </button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder={`用 ${word.word} 写一个例句…`}
                      aria-label={`用 ${word.word} 写例句`}
                      value={answers[word.sourceIndex] || ''}
                      onChange={(e) =>
                        setAnswers((a) => ({
                          ...a,
                          [word.sourceIndex]: e.target.value,
                        }))
                      }
                    />
                  </article>
                ))}
              </div>
              {!drawn.length && (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed text-muted-foreground">
                  请先导入词表
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
