import { Reveal, SectionHead } from '@/components/site/primitives';

const pains = [
  {
    n: '01',
    title: '换个问法，就找不到准备好的答案',
    body: '你背了 80 道题，面试官换个说法，大脑一片空白。',
  },
  {
    n: '02',
    title: '现场生成的答案，一听就是编的',
    body: '满嘴赋能、抓手、闭环，却没有一个数字来自你自己的项目。',
  },
  {
    n: '03',
    title: '收藏了两百道八股，一道没讲成自己的',
    body: '知识是别人的，经历是沉默的，中间缺一次结构化。',
  },
  {
    n: '04',
    title: '每场面试只留下「感觉没发挥好」',
    body: '哪句话让对方起疑、下次该改哪一句，全靠回忆。',
  },
];

export function PainPoints() {
  return (
    <section id="pain" className="relative scroll-mt-24 py-[72px] md:py-[120px]">
      <div className="s-wrap">
        <SectionHead
          index="02"
          kicker="痛点"
          title={
            <>
              你缺的不是更多题库，
              <br className="hidden sm:block" />
              是<span className="s-grad">能说出口的那一版答案</span>。
            </>
          }
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
          {pains.map((p, i) => (
            <Reveal key={p.n} delay={i * 80} className="h-full">
              <article className="s-card s-card-hover group flex h-full flex-col p-6">
                <span className="s-mono text-[34px] leading-none tracking-[-0.02em] text-[#232b38] transition-colors duration-300 group-hover:text-[#6f9dff]">
                  {p.n}
                </span>
                <h3 className="mt-6 text-[15.5px] font-medium leading-[1.65] text-[#e9edf5]">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-[13.5px] leading-[1.9] text-[#97a1b2]">{p.body}</p>
                <span className="mt-auto pt-6">
                  <span className="block h-px w-8 bg-[#222b38] transition-colors duration-300 group-hover:bg-[#33507e]" />
                </span>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={240}>
          <p className="mx-auto mt-14 max-w-[740px] text-center text-[15px] leading-[1.9] text-[#7d8798] md:mt-16 md:text-[16.5px]">
            面试副驾只做一件事：
            <span className="text-[#e9edf5]">让准备好的东西，在需要的那一刻原样出现。</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
