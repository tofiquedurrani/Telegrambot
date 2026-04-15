    if (state.step === "vehicle_await_reg") {
      const regNo = text.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      if (regNo.length < 3) {
        await bot.sendMessage(chatId, "Invalid registration number. Example: NFH-3057");
        return;
      }
      setState(chatId, { step: "processing" });
      await bot.sendMessage(
        chatId,
        `Searching ${state.vehicleType} details for ${regNo}...\nPlease wait...`
      );
      try {
        const data = await searchVehicle(
          regNo,
          (progress) => { bot.sendMessage(chatId, progress).catch(() => {}); }
        );
        setState(chatId, { step: "idle" });
        let reply = `Vehicle Details for ${regNo}:\n\n`;
        for (const [key, value] of Object.entries(data)) {
          if (key && value) reply += `${key}: ${value}\n`;
        }
        await bot.sendMessage(chatId, reply);
      } catch (err: unknown) {
        const errMsg = (err instanceof Error ? err.message : "Search failed")
          .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        setState(chatId, { step: "idle" });
        await bot.sendMessage(chatId, `Vehicle search failed:\n${errMsg}\n\nUse /bike or /car to try again.`);
      }
      return;
    }
