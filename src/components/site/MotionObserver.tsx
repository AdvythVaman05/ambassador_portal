import { useEffect } from "react";

/**
 * Progressive motion enhancement for the editorial site. Nothing is hidden in
 * CSS: content stays usable if JavaScript or GSAP fails to load.
 */
export function MotionObserver() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let reverted = false;
    let cleanup: (() => void) | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([gsapModule, scrollTriggerModule]) => {
        if (reverted) return;

        const gsap = gsapModule.gsap;
        const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        const context = gsap.context(() => {
          document.querySelectorAll<HTMLElement>("[data-motion-hero]").forEach((hero) => {
            const items = hero.querySelectorAll<HTMLElement>(
              "[data-motion-hero-item], [data-motion-clip]",
            );
            gsap.from(items, {
              autoAlpha: 0,
              y: 22,
              duration: 0.72,
              ease: "power3.out",
              stagger: 0.1,
              clearProps: "transform,opacity,visibility",
            });
          });

          document
            .querySelectorAll<HTMLElement>("[data-motion-section], [data-reveal]")
            .forEach((section) => {
              const heading = section.querySelector<HTMLElement>(
                "[data-motion-heading], .eyebrow, h1, h2",
              );
              const body = section.querySelector<HTMLElement>(
                "[data-motion-body], p:not(.eyebrow)",
              );
              const targets = [heading, body].filter(Boolean) as HTMLElement[];
              if (!targets.length) return;
              gsap.from(targets, {
                autoAlpha: 0,
                y: 18,
                duration: 0.58,
                ease: "power2.out",
                stagger: 0.1,
                clearProps: "transform,opacity,visibility",
                scrollTrigger: { trigger: section, start: "top 82%", once: true },
              });
            });

          document.querySelectorAll<HTMLElement>("[data-motion-stagger]").forEach((group) => {
            const cards = group.querySelectorAll<HTMLElement>("[data-motion-card]");
            if (!cards.length) return;
            gsap.from(cards, {
              autoAlpha: 0,
              y: 20,
              duration: 0.55,
              ease: "power2.out",
              stagger: 0.08,
              clearProps: "transform,opacity,visibility",
              scrollTrigger: { trigger: group, start: "top 84%", once: true },
            });
          });

          document.querySelectorAll<HTMLElement>("[data-motion-clip]").forEach((visual) => {
            if (visual.closest("[data-motion-hero]")) return;
            gsap.from(visual, {
              clipPath: "inset(0 0 100% 0)",
              duration: 0.85,
              ease: "power3.out",
              clearProps: "clipPath",
              scrollTrigger: { trigger: visual, start: "top 82%", once: true },
            });
          });

          const desktopMotion = gsap.matchMedia();
          desktopMotion.add("(min-width: 1024px)", () => {
            document.querySelectorAll<HTMLElement>("[data-motion-parallax]").forEach((visual) => {
              gsap.to(visual, {
                yPercent: -4,
                ease: "none",
                scrollTrigger: {
                  trigger: visual,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.5,
                },
              });
            });
          });
          cleanup = () => {
            desktopMotion.revert();
            context.revert();
          };
        }, document.body);
      })
      .catch(() => {
        // Motion is deliberately optional; the unanimated experience remains intact.
      });

    return () => {
      reverted = true;
      cleanup?.();
    };
  }, []);

  return null;
}
