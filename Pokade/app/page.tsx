"use client";

/**
 * POKADE / Active Future Product Page
 * Photo-led Pokemon card product story with a glass command dock, magnetic CTAs,
 * pointer-responsive image stages, and beam-led section transitions.
 * Ported from a standalone Manus export — this route intentionally opts out of
 * the shared Pokade Header/Footer (see Header.tsx / Footer.tsx pathname guards)
 * and ships its own header, nav, and footer to match the original design 1:1.
 */
import { Noto_Sans_KR } from "next/font/google";
import { Accordion, AccordionItem } from "./FutureAccordion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Camera,
  Check,
  CircleGauge,
  Menu,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useUserStore } from "@/store/useUserStore";
import "./future-landing.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const ASSET = {
  hero: "/manus-storage/pokemon-pikachu-hero_2d213799.jpg",
  pikachuCard: "https://images.scrydex.com/pokemon/sm3-20/large",
  charizardWide: "/manus-storage/pokemon-charizard-wide_93e4e407.jpg",
  charizardCard: "/demo/ai-diagnosis/front.png",
  detectiveCase: "/demo/ai-diagnosis/back.png",
  sleeves: "/images/hero-bg.jpg",
};

const benefits = [
  {
    image: ASSET.pikachuCard,
    label: "AI 상태 예비진단",
    meta: "사진 기반 확인",
    title: "사진으로 먼저 확인",
    copy: "카드 앞뒤 사진을 올리고 상태 예비진단을 시작하세요.",
    icon: ScanLine,
  },
  {
    image: ASSET.charizardCard,
    label: "시세 신호",
    meta: "거래 기록",
    title: "시세 흐름 한눈에",
    copy: "체결 데이터 기반 참고 시세와 변화 기록을 함께 봐요.",
    icon: BarChart3,
  },
  {
    image: ASSET.detectiveCase,
    label: "안전 거래",
    meta: "안내 절차",
    title: "안전하게 거래",
    copy: "거래 전 확인해야 할 기준을 한곳에 정리해요.",
    icon: ShieldCheck,
  },
];

type Navigate = (id: string) => void;

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.62, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

function MagneticButton({
  children,
  className,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  className: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 18 });
  const springY = useSpring(y, { stiffness: 260, damping: 18 });
  const move = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (reducedMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - box.left - box.width / 2) * 0.12);
    y.set((event.clientY - box.top - box.height / 2) * 0.14);
  };

  return (
    <motion.button
      type="button"
      className={className}
      onClick={onClick}
      onMouseMove={move}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.96 }}
      aria-label={ariaLabel}
    >
      {children}
    </motion.button>
  );
}

function CommandDock({ navigate }: { navigate: Navigate }) {
  const items = [
    { id: "ai-check", label: "AI 확인", icon: ScanLine },
    { id: "price", label: "시세", icon: CircleGauge },
    { id: "collection", label: "컬렉션", icon: Camera },
    { id: "start", label: "거래 기준", icon: ShieldCheck },
  ];
  return (
    <nav className="future-command-dock" aria-label="빠른 이동">
      {items.map(({ id, label, icon: Icon }, index) => (
        <motion.button
          type="button"
          key={id}
          onClick={() => navigate(id)}
          className="future-dock-item"
          whileHover={{ y: -5, scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          transition={{ duration: 0.18 }}
        >
          <Icon size={18} strokeWidth={1.8} />
          <span>{label}</span>
          <i>{String(index + 1).padStart(2, "0")}</i>
        </motion.button>
      ))}
    </nav>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingPage() {
  const router = useRouter();
  const authStatus = useUserStore((s) => s.status);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const tiltX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { stiffness: 130, damping: 20 });
  const tiltY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), { stiffness: 130, damping: 20 });
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const { scrollYProgress: pageProgress } = useScroll();
  const heroScale = useTransform(heroProgress, [0, 1], [1, 1.14]);
  const heroY = useTransform(heroProgress, [0, 1], [0, 78]);
  const copyY = useTransform(heroProgress, [0, 1], [0, -56]);
  const copyOpacity = useTransform(heroProgress, [0, 0.78], [1, 0]);

  // 랜딩페이지는 비로그인 방문자에게만 보여준다 — 이미 로그인한 사용자는 실제 홈으로 바로 보낸다.
  useEffect(() => {
    if (authStatus === "authenticated") router.replace("/home");
  }, [authStatus, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navigate: Navigate = (id) => {
    setMobileOpen(false);
    scrollToId(id);
  };

  const trackHeroPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    mouseX.set((event.clientX - box.left) / box.width - 0.5);
    mouseY.set((event.clientY - box.top) / box.height - 0.5);
  };

  // 로그인 여부를 확인하는 동안, 그리고 로그인 사용자를 /home으로 보내는 동안은 랜딩을 그리지 않는다.
  if (authStatus !== "unauthenticated") return null;

  return (
    <div
      className={`future-page min-h-screen overflow-x-clip bg-[#f8fbff] text-[#111827] ${notoSansKr.className}`}
    >
      <header
        className={`future-header fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "future-header-scrolled" : ""}`}
      >
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <button
            className="flex items-center gap-2.5"
            onClick={() => router.push("/home")}
            type="button"
            aria-label="POKADE 홈으로 이동"
          >
            <span className="future-logo-mark">
              <span />
              <span />
            </span>
            <span className="text-[19px] font-extrabold tracking-[-0.06em]">POKADE</span>
          </button>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#506072] md:flex" aria-label="주요 메뉴">
            <button type="button" onClick={() => navigate("ai-check")} className="future-nav-link">
              AI 상태 확인
            </button>
            <button type="button" onClick={() => navigate("price")} className="future-nav-link">
              카드 시세
            </button>
            <button type="button" onClick={() => navigate("collection")} className="future-nav-link">
              내 컬렉션
            </button>
          </nav>
          <MagneticButton onClick={() => router.push("/home")} className="future-header-cta hidden md:inline-flex">
            시작하기 <ArrowUpRight size={15} />
          </MagneticButton>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#dbe5f2] bg-white/75 text-[#111827] backdrop-blur-xl md:hidden"
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <motion.div className="future-scroll-progress" style={{ scaleX: pageProgress }} aria-hidden="true" />
        {mobileOpen ? (
          <div className="future-mobile-menu md:hidden">
            <nav
              className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-5 text-[15px] font-semibold text-[#243142]"
              aria-label="모바일 메뉴"
            >
              <button type="button" onClick={() => navigate("ai-check")} className="future-mobile-link">
                AI 상태 확인 <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => navigate("price")} className="future-mobile-link">
                카드 시세 <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => navigate("collection")} className="future-mobile-link">
                내 컬렉션 <ArrowRight size={16} />
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="top" className="pb-28 sm:pb-32">
        <section ref={heroRef} className="future-hero pt-[76px]">
          <div className="future-hero-shell mx-auto grid max-w-[1280px] overflow-hidden md:min-h-[680px] md:grid-cols-[.88fr_1.12fr]">
            <motion.div className="future-hero-copy" style={{ y: copyY, opacity: copyOpacity }}>
              <motion.p
                className="future-kicker"
                initial={reducedMotion ? false : { opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45 }}
              >
                <span /> 포켓몬 카드 거래 기준 / 2026
              </motion.p>
              <motion.h1
                initial={reducedMotion ? false : { opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.72, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
              >
                포켓몬 카드,
                <br />
                <em>더 확실하게</em>
                <br />
                거래해요.
              </motion.h1>
              <motion.p
                className="future-hero-description"
                initial={reducedMotion ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.22 }}
              >
                사진으로 상태를 확인하고, 체결 데이터 기반 시세를 살펴보세요. POKADE가 카드 거래의
                판단을 더 빠르고 명확하게 도와드려요.
              </motion.p>
              <motion.div
                className="mt-9 flex flex-wrap gap-3"
                initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.34 }}
              >
                <MagneticButton onClick={() => router.push("/search")} className="future-primary-button">
                  카드 시세 확인 <ArrowRight size={17} />
                </MagneticButton>
                <MagneticButton onClick={() => router.push("/ai-diagnosis")} className="future-glass-button">
                  AI 상태 확인 <ScanLine size={17} />
                </MagneticButton>
              </motion.div>
              <motion.div
                className="future-hero-metrics"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.52, duration: 0.5 }}
              >
                <span>
                  <i /> 사진 확인
                </span>
                <span>
                  <i /> 시세 신호
                </span>
                <span>
                  <i /> 안전 절차
                </span>
              </motion.div>
            </motion.div>
            <div
              className="future-hero-stage"
              onMouseMove={trackHeroPointer}
              onMouseLeave={() => {
                mouseX.set(0);
                mouseY.set(0);
              }}
            >
              <motion.div
                className="future-photo-stage"
                style={{ rotateX: tiltX, rotateY: tiltY, scale: heroScale, y: heroY }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ASSET.hero} alt="숲속에서 휴식 중인 피카츄 이미지" fetchPriority="high" />
                <div className="future-stage-shade" />
                <motion.div
                  className="future-scan-frame"
                  animate={reducedMotion ? undefined : { rotate: [0, 1.8, 0, -1.8, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="future-scan-chip">카드 상태 보기</span>
                  <span className="future-scan-id">카드 번호 / 026</span>
                  <b />
                  <i />
                </motion.div>
                <div className="future-floating-data data-one">
                  <span>01</span>
                  <strong>상태</strong>
                  <em>예비진단</em>
                </div>
                <div className="future-floating-data data-two">
                  <span>02</span>
                  <strong>시세</strong>
                  <em>흐름 확인</em>
                </div>
                <div className="future-stage-caption">
                  <span>포켓몬 컬렉션</span>
                  <span>01 / 시작</span>
                </div>
              </motion.div>
            </div>
          </div>
          <div className="future-hero-scroll" aria-hidden="true">
            <span>다음 내용 보기</span>
            <ArrowDown size={14} />
          </div>
        </section>

        <section className="future-intro">
          <Reveal className="mx-auto max-w-[900px] text-center">
            <p className="future-kicker justify-center">
              <span /> 수집가를 위해
            </p>
            <h2>
              카드를 좋아하는 마음과
              <br />
              <em>거래의 기준</em>은 같이 가야 하니까요.
            </h2>
            <p>
              좋아하는 카드를 오래 모으고 싶다면, 지금 이 카드가 어떤 상태인지와 얼마에 거래되는지를
              함께 확인해야 해요.
            </p>
          </Reveal>
        </section>

        <section id="ai-check" className="future-beam-section future-grid-section scroll-mt-20">
          <div className="future-beam" aria-hidden="true">
            <span />
          </div>
          <div className="future-feature-grid">
            <Reveal className="future-feature-copy">
              <p className="future-kicker">
                <span /> AI 상태 예비진단
              </p>
              <h2>
                사진으로
                <br />
                카드 상태를 먼저
                <br />
                <em>확인해요.</em>
              </h2>
              <p>
                등급에 상관없이, 항상 공정한 비용으로 측정하세요. 높은 등급부터 낮은 등급까지 모두
                부담 없는 가격에 가능합니다.
              </p>
              <div className="future-note">
                <Sparkles size={16} /> AI 진단은 참고용 예비진단이며 정식 감정을 대체하지 않아요.
              </div>
              <div className="future-data-pills">
                <span>사진 기반</span>
                <span>상태 확인</span>
              </div>
            </Reveal>
            <Reveal delay={0.1} className="future-record-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSET.pikachuCard} alt="피카츄 포켓몬 카드" loading="lazy" />
              <span className="future-record-top">AI 예비진단</span>
              <span className="future-record-bottom">포케이드 / 카드 기록</span>
              <i className="future-orbit orbit-a" />
              <i className="future-orbit orbit-b" />
            </Reveal>
          </div>
        </section>

        <section id="price" className="future-price-section scroll-mt-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSET.charizardWide} alt="리자몽 포켓몬 카드 아트" loading="eager" />
          <div className="future-price-overlay" />
          <div className="future-price-beams" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="future-price-record" aria-hidden="true">
            <span>포케이드 / 카드 기록</span>
            <strong>시세 신호</strong>
            <em>02 / 실시간</em>
          </div>
          <Reveal className="future-price-copy">
            <p className="future-kicker text-[#b6ddff]">
              <span /> 카드 시세
            </p>
            <h2>
              이 가격, 지금
              <br />
              <em>적절한 걸까요?</em>
            </h2>
            <p>
              하나의 숫자만 보지 말고, 체결가와 가격 흐름을 함께 살펴보세요. 카드마다 다른 거래의
              맥락을 확인할 수 있어요.
            </p>
            <div className="future-price-pills">
              <span>거래 기록</span>
              <span>가격 흐름</span>
              <span>관심 카드</span>
            </div>
            <MagneticButton onClick={() => router.push("/ranking")} className="future-white-button">
              시세 확인 기준 보기 <ArrowRight size={17} />
            </MagneticButton>
          </Reveal>
        </section>

        <section className="future-signal-section">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
            <Reveal>
              <p className="future-kicker">
                <span /> 하나의 분명한 흐름
              </p>
              <h2>
                찾고, 확인하고,
                <br />
                <em>안전하게 이어가요.</em>
              </h2>
              <div className="future-walkthrough-key">
                <span>01 / 사진 확인</span>
                <i />
                <span>02 / 시세 신호</span>
                <i />
                <span>03 / 안전 절차</span>
              </div>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {benefits.map(({ image, label, meta, title, copy, icon: Icon }, index) => (
                <motion.article
                  key={title}
                  className="future-signal-card"
                  initial={reducedMotion ? false : { opacity: 0, y: 36 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -10 }}
                  viewport={{ once: true, amount: 0.24 }}
                  transition={{ duration: 0.48, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="future-signal-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" loading="eager" />
                    <span>{label}</span>
                    <i>
                      <Icon size={17} />
                    </i>
                    <div className="future-record-caption">
                      <b>포케이드 / 카드 기록</b>
                      <em>0{index + 1} / 03</em>
                    </div>
                  </div>
                  <p className="future-signal-meta">{meta}</p>
                  <h3>{title}</h3>
                  <p className="future-signal-copy">{copy}</p>
                  <div className="future-card-line">
                    <b />
                    <span>0{index + 1}</span>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="collection" className="future-collection-section scroll-mt-20">
          <div className="future-collection-grid">
            <Reveal className="future-collection-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSET.charizardCard} alt="투명 케이스에 보관된 리자몽 포켓몬 카드" loading="eager" />
              <div className="future-collection-tag">
                <span>포케이드 / 카드 기록</span>
                <strong>03 / 컬렉션</strong>
              </div>
              <div className="future-collection-status">
                <Check size={13} /> 컬렉션에 기록됨
              </div>
              <i className="future-glare" />
            </Reveal>
            <Reveal delay={0.1} className="future-feature-copy">
              <p className="future-kicker">
                <span /> 컬렉션 기록
              </p>
              <h2>
                내 카드,
                <br />한 곳에서
                <br />
                <em>모아봐요.</em>
              </h2>
              <p>
                카드 한 장씩의 기록이 모이면, 내 컬렉션 전체의 흐름이 보여요. 보유 카드와 관심 카드를
                더 쉽게 관리할 수 있어요.
              </p>
              <MagneticButton onClick={() => router.push("/portfolio")} className="future-primary-button mt-8">
                내 컬렉션 시작하기 <ArrowRight size={17} />
              </MagneticButton>
            </Reveal>
          </div>
        </section>

        <section id="start" className="future-faq-section scroll-mt-20">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[.85fr_1.15fr]">
            <Reveal>
              <p className="future-kicker">
                <span /> 거래 안내
              </p>
              <h2>
                거래 전,
                <br />
                <em>알아둘 내용.</em>
              </h2>
              <p>신뢰할 수 있는 거래를 위해, 시세 정보와 AI 예비진단의 역할을 분명하게 안내해요.</p>
            </Reveal>
            <Reveal delay={0.08}>
              <Accordion className="future-accordion">
                <AccordionItem question="AI 상태 예비진단은 무엇인가요?">
                  사진을 기반으로 카드 상태를 참고용으로 확인하는 예비진단입니다. 정식 감정 결과를
                  보장하거나 대체하지 않으며, 거래 판단을 돕는 보조 정보로 사용합니다.
                </AccordionItem>
                <AccordionItem question="시세 정보는 어떻게 활용하면 되나요?">
                  시세와 거래 흐름은 카드의 가격을 판단할 때 참고할 수 있는 정보입니다. 실제 거래
                  전에는 카드 상태, 거래 조건, 최신 안내를 함께 확인해 주세요.
                </AccordionItem>
                <AccordionItem question="안전거래는 어떤 방향으로 설계되나요?">
                  플랫폼이 거래 과정을 확인하고 확정하는 구조를 지향합니다. 구체적인 거래 정책과
                  운영 범위는 서비스 출시 전 공식 안내를 기준으로 확인해 주세요.
                </AccordionItem>
              </Accordion>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="future-footer text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSET.sleeves} alt="" className="future-footer-image" loading="lazy" />
        <div className="future-footer-overlay" />
        <div className="future-footer-content">
          <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-10 px-5 py-20 sm:px-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold tracking-[.12em] text-white/70">
                포켓몬 카드 수집가를 위한 포케이드
              </p>
              <h2>
                좋아하는 카드,
                <br />
                <em>더 확실하게</em> 만나세요.
              </h2>
            </div>
            <MagneticButton onClick={() => navigate("top")} className="future-footer-button">
              위로 돌아가기 <ArrowUpRight size={16} />
            </MagneticButton>
          </div>
          <div className="mx-auto flex max-w-[1280px] flex-col gap-3 border-t border-white/20 px-5 py-6 text-xs font-semibold text-white/60 sm:flex-row sm:justify-between sm:px-8">
            <span>© POKADE. ALL RIGHTS RESERVED.</span>
            <span>포켓몬 카드 가치·거래 플랫폼</span>
          </div>
        </div>
      </footer>
      <CommandDock navigate={navigate} />
    </div>
  );
}
