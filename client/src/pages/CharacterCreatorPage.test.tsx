import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CharacterCreatorPage } from "./CharacterCreatorPage";
import { resetGameStoreForTests, useGameStore } from "../state/store";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderCreator() {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CharacterCreatorPage />} />
        <Route path="/play" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CharacterCreatorPage", () => {
  beforeEach(() => {
    resetGameStoreForTests();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders name input + 5 roots sliders + 3 trait cards + submit button", () => {
    renderCreator();

    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByLabelText("金灵根值")).toBeTruthy();
    expect(screen.getByLabelText("木灵根值")).toBeTruthy();
    expect(screen.getByLabelText("水灵根值")).toBeTruthy();
    expect(screen.getByLabelText("火灵根值")).toBeTruthy();
    expect(screen.getByLabelText("土灵根值")).toBeTruthy();
    expect(screen.getByRole("button", { name: /右臂经脉/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /雷罚残痕/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /非法灵根/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /进入九龙下城/ })).toBeTruthy();
  });

  it("disables submit when name is empty", async () => {
    const user = userEvent.setup();
    renderCreator();

    const nameInput = screen.getByRole("textbox");
    await user.clear(nameInput);

    const submit = screen.getByRole("button", { name: /进入九龙下城/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/名字需要 1-12 个字符/)).toBeTruthy();
  });

  it("toggles a trait when its card is clicked", async () => {
    const user = userEvent.setup();
    renderCreator();

    const leifaCard = screen.getByRole("button", { name: /雷罚残痕/ });
    expect(leifaCard.getAttribute("aria-pressed")).toBe("false");

    await user.click(leifaCard);
    expect(leifaCard.getAttribute("aria-pressed")).toBe("true");

    await user.click(leifaCard);
    expect(leifaCard.getAttribute("aria-pressed")).toBe("false");
  });

  it("submits with name + roots + traitId and navigates to /play", async () => {
    const initSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ initializeSession: initSpy });

    const user = userEvent.setup();
    renderCreator();

    const nameInput = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "夜辰");

    await user.click(screen.getByRole("button", { name: /雷罚残痕/ }));

    await user.click(screen.getByRole("button", { name: /进入九龙下城/ }));

    await waitFor(() => {
      expect(initSpy).toHaveBeenCalledTimes(1);
    });
    const callArg = initSpy.mock.calls[0][0];
    expect(callArg).toMatchObject({ name: "夜辰", traitId: "leifa_scar" });
    expect(callArg.roots).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toBe("/play");
    });
  });

  it("quick-start button submits with empty body and navigates to /play", async () => {
    const initSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ initializeSession: initSpy });

    const user = userEvent.setup();
    renderCreator();

    await user.click(screen.getByRole("button", { name: /用默认/ }));

    await waitFor(() => {
      expect(initSpy).toHaveBeenCalledWith({});
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toBe("/play");
    });
  });
});
