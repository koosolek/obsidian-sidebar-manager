// Keeps the mobile left sidebar clear of the on-screen keyboard. Obsidian's mobile app lets the
// keyboard slide over the web view, so the sidebar's bottom part (on phones: the view selector and
// the end of the search results) ends up underneath it. While the keyboard is up we pad the
// drawer's bottom by exactly the part the keyboard covers.

export class KeyboardInset {
	private cleanups: (() => void)[] = [];
	private keyboardHeight = 0;
	/** Window height with the keyboard down, to tell whether the web view shrank for the keyboard. */
	private restingInnerHeight = window.innerHeight;
	private frame = 0;

	constructor(private getDrawerEl: () => HTMLElement | null) {}

	start() {
		const onShow = (e: Event) => {
			const h = (e as Event & { keyboardHeight?: number }).keyboardHeight;
			this.keyboardHeight = typeof h === "number" ? h : this.cssKeyboardHeight();
			this.schedule();
		};
		const onHide = () => {
			this.keyboardHeight = 0;
			this.schedule();
		};
		const onViewport = () => {
			if (this.keyboardHeight === 0 && this.cssKeyboardHeight() === 0) this.restingInnerHeight = window.innerHeight;
			this.schedule();
		};
		const onFocus = () => window.setTimeout(() => this.schedule(), 350);

		window.addEventListener("keyboardWillShow", onShow);
		window.addEventListener("keyboardDidShow", onShow);
		window.addEventListener("keyboardWillHide", onHide);
		window.addEventListener("keyboardDidHide", onHide);
		window.addEventListener("resize", onViewport);
		window.visualViewport?.addEventListener("resize", onViewport);
		document.addEventListener("focusin", onFocus);
		document.addEventListener("focusout", onFocus);
		this.cleanups.push(() => {
			window.removeEventListener("keyboardWillShow", onShow);
			window.removeEventListener("keyboardDidShow", onShow);
			window.removeEventListener("keyboardWillHide", onHide);
			window.removeEventListener("keyboardDidHide", onHide);
			window.removeEventListener("resize", onViewport);
			window.visualViewport?.removeEventListener("resize", onViewport);
			document.removeEventListener("focusin", onFocus);
			document.removeEventListener("focusout", onFocus);
		});
	}

	stop() {
		this.cleanups.forEach((c) => c());
		this.cleanups = [];
		cancelAnimationFrame(this.frame);
		this.apply(0);
	}

	private schedule() {
		cancelAnimationFrame(this.frame);
		this.frame = requestAnimationFrame(() => this.update());
	}

	private cssKeyboardHeight(): number {
		return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height")) || 0;
	}

	/** The y coordinate below which the keyboard hides things. */
	private visibleBottom(): number {
		const keyboard = Math.max(this.keyboardHeight, this.cssKeyboardHeight());
		const vv = window.visualViewport;
		let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
		if (keyboard > 0) {
			// If the web view already shrank by (most of) the keyboard, the keyboard covers nothing.
			const shrunk = this.restingInnerHeight - window.innerHeight;
			if (shrunk < keyboard / 2) bottom = Math.min(bottom, this.restingInnerHeight - keyboard);
		}
		return bottom;
	}

	private update() {
		const drawer = this.getDrawerEl();
		if (!drawer) return;
		// Padding doesn't move the drawer's box, so measuring with our inset applied is fine.
		const inner = drawer.querySelector<HTMLElement>(".workspace-drawer-inner");
		// Not isShown(): the drawer is position: fixed, so it never has an offsetParent.
		const rect = inner?.getBoundingClientRect();
		if (!rect || rect.width === 0) return this.apply(0);
		const covered = rect.bottom - this.visibleBottom();
		this.apply(covered > 1 ? Math.round(covered) : 0);
	}

	private apply(px: number) {
		const drawer = this.getDrawerEl();
		if (!drawer) return;
		drawer.toggleClass("osm-keyboard-open", px > 0);
		if (px > 0) drawer.style.setProperty("--osm-keyboard-inset", `${px}px`);
		else drawer.style.removeProperty("--osm-keyboard-inset");
	}
}
