"""
Rule-based crop advisory expert system.

Deliberately NOT machine-learned: this is the explainable, auditable layer that
translates model probabilities into concrete farmer actions, mirroring how real
agri-extension advisories are structured (ICAR-style condition -> action rules).
This module is fully real today -- nothing here is mocked, and it will not change
when the ML/DL models are wired in tomorrow (it just starts consuming real
probabilities instead of mock ones).
"""

from dataclasses import dataclass


@dataclass
class Advisory:
    severity: str  # "info" | "caution" | "warning" | "critical"
    title_en: str
    title_hi: str
    message_en: str
    message_hi: str
    action_en: str
    action_hi: str


CROP_STAGE_SENSITIVITY = {
    # crude sowing-window heuristic per crop for the demo's "current growth stage" guess
    "Cotton": "sowing",
    "Soybean": "sowing",
    "Bajra": "sowing",
    "Groundnut": "sowing",
    "Paddy": "transplanting",
    "Sugarcane": "vegetative",
    "Grapes": "vegetative",
    "Jowar": "sowing",
    "Tur Dal": "sowing",
    "Tea": "vegetative",
    "Coffee": "vegetative",
    "Jute": "sowing",
    "Maize": "sowing",
    "Tapioca": "sowing",
    "Wheat/Paddy": "sowing",
}


def generate_advisory(forecast: dict, stage: str | None = None) -> Advisory:
    """Core rule engine: forecast snapshot + crop + growth stage -> actionable advisory.

    Priority order: false onset shield > break-monsoon risk > heavy rain risk > onset opportunity > routine.
    """
    current = forecast["current"]
    crop = forecast.get("primary_crop", "Crops")
    if not stage:
        stage = forecast.get("stage") or CROP_STAGE_SENSITIVITY.get(crop, "sowing")
    stage = stage.lower()

    onset_p = current["onset_probability"]
    break_p = current["break_probability"]
    heavy_p = current["heavy_rain_probability"]

    # 1. False Onset Shield: elevated onset immediately accompanied by elevated dry-spell risk
    if onset_p >= 0.50 and break_p >= 0.50 and stage in ("planning", "sowing", "nursery", "transplanting"):
        return Advisory(
            severity="warning",
            title_en=f"Possible False Onset Alert for {crop}",
            title_hi=f"{crop} ke liye sambhavit jhootha monsoon (False Onset) alert",
            message_en=(
                f"Rainfall may initially improve ({onset_p*100:.0f}% onset probability), but the forecast "
                f"indicates an elevated chance of a dry spell ({break_p*100:.0f}%) afterward during {stage}. "
                "Early sowing without assured irrigation risks seedling mortality."
            ),
            message_hi=(
                f"Shuruat mein barish sudhar sakti hai ({onset_p*100:.0f}% aagman sambhavna), lekin poorvanuman "
                f"{stage} ke baad sookhe daur ({break_p*100:.0f}%) ka sanket deta hai. "
                "Bina pakki sinchai ke jaldi buwai karne se beej kharab ho sakte hain."
            ),
            action_en="Hold off rainfed sowing for 5–7 days until rainfall stabilizes. If sowing in nursery, prepare contingency irrigation.",
            action_hi="Barish sthir hone tak 5–7 din buwai rokein. Agar nursery mein hain, to aapatkalin sinchai taiyar rakhein.",
        )

    # 2. Break-monsoon / extended dry-spell risk
    if break_p >= 0.55:
        if stage in ("planning", "sowing", "nursery"):
            return Advisory(
                severity="critical" if break_p >= 0.65 else "warning",
                title_en=f"High break-monsoon risk during {stage} for {crop}",
                title_hi=f"{crop} ki {stage} ke dauran monsoon break ka khatra",
                message_en=(
                    f"{break_p*100:.0f}% probability of an extended dry spell in the next 7–10 days. "
                    f"Sowing or maintaining open nursery beds now risks severe moisture stress."
                ),
                message_hi=(
                    f"Agle 7-10 dino mein lambe sookhe daur ki {break_p*100:.0f}% sambhavna hai. "
                    f"Abhi buwai karne se ya khuli nursery mein nami ki bhari kami ho sakti hai."
                ),
                action_en="Delay sowing by 5–7 days. If already sown, apply light supplemental irrigation and mulching immediately.",
                action_hi="Buwai ko 5–7 din ke liye taal dein. Agar bo chuke hain, turant halki sinchai aur mulch ka prayog karein.",
            )
        elif stage in ("transplanting", "vegetative", "flowering"):
            return Advisory(
                severity="warning",
                title_en=f"Moisture stress risk for standing {crop} ({stage})",
                title_hi=f"Khadi fasal {crop} ({stage}) ke liye nami ki kami ka khatra",
                message_en=(
                    f"{break_p*100:.0f}% dry-spell probability during active {stage}. "
                    "Moisture deficit can impair tillering, flowering, or grain filling."
                ),
                message_hi=(
                    f"{stage} ke dauran sookhe daur ki {break_p*100:.0f}% sambhavna hai. "
                    "Nami ki kami se fasal ke vikas aur paidawar par asar pad sakta hai."
                ),
                action_en="Arrange supplemental irrigation via drip or furrow. Avoid nitrogenous fertilizer top-dressing until moisture recovers.",
                action_hi="Drip ya furrow vidhi se sanrakshit sinchai karein. Nami aane tak nitrogen yukt urea/khaad na dalein.",
            )
        elif stage in ("harvest",):
            return Advisory(
                severity="info",
                title_en=f"Dry window favorable for {crop} harvest",
                title_hi=f"{crop} ki katai ke liye sookha mausam anukool",
                message_en=(
                    f"Dry weather outlook ({break_p*100:.0f}% dry probability) provides a safe window for harvesting and threshing."
                ),
                message_hi=(
                    f"Sookha mausam ({break_p*100:.0f}% sambhavna) fasal ki katai aur gehai ke liye surakshit samay pradan karta hai."
                ),
                action_en="Proceed with harvesting mature crop. Ensure threshing and sun-drying are completed in this window.",
                action_hi="Pakki fasal ki katai shuru karein. Is samay mein gehai aur sukhane ka kaam pura karein.",
            )

    # 3. Heavy rain / downpour risk
    if heavy_p >= 0.55:
        if stage in ("harvest",):
            return Advisory(
                severity="critical",
                title_en=f"Critical: Heavy rainfall threat to {crop} harvest",
                title_hi=f"Aapatkalin: {crop} katai par bhaari barish ka khatra",
                message_en=(
                    f"{heavy_p*100:.0f}% probability of heavy downpour. Unharvested or field-stored produce faces grain damage, sprouting, and fungal rot."
                ),
                message_hi=(
                    f"Bhaari barish ki {heavy_p*100:.0f}% sambhavna hai. Khet mein padi ya pakki fasal mein sadan aur ankurit hone ka bhari khatra hai."
                ),
                action_en="Expedite harvesting of mature crop immediately and move produce to covered, elevated storage.",
                action_hi="Turant pakki fasal ki katai karein aur anaj ko surakshit chhat ke niche rakhein.",
            )
        elif stage in ("planning", "sowing", "nursery"):
            return Advisory(
                severity="warning",
                title_en=f"Heavy rain risk for {crop} sowing & nursery",
                title_hi=f"{crop} buwai aur nursery ke liye bhaari barish ka khatra",
                message_en=(
                    f"{heavy_p*100:.0f}% probability of heavy downpour in the next 7 days. "
                    "Risk of seed washout, soil compaction, and nursery bed submergence."
                ),
                message_hi=(
                    f"Agle 7 dino mein bhaari barish ki {heavy_p*100:.0f}% sambhavna hai. "
                    "Beej bahne, mitti dabne aur nursery mein pani bharne ka khatra hai."
                ),
                action_en="Postpone sowing until the heavy spell subsides. Create drainage channels around nursery beds.",
                action_hi="Bhaari barish nikalne tak buwai rokein. Nursery ke charo taraf jal nikasi ki naliyan banayein.",
            )
        else:
            return Advisory(
                severity="warning",
                title_en=f"Heavy rainfall risk for {crop} fields ({stage})",
                title_hi=f"{crop} kheton ({stage}) ke liye bhaari barish ka khatra",
                message_en=(
                    f"{heavy_p*100:.0f}% probability of heavy downpour in the next 7 days. "
                    "Risk of waterlogging and nutrient runoff."
                ),
                message_hi=(
                    f"Agle 7 dino mein bhaari barish ki {heavy_p*100:.0f}% sambhavna hai. "
                    "Jalbharav aur poshak tatvon ke bahne ka khatra hai."
                ),
                action_en="Ensure field drainage channels are clear. Delay fertilizer and pesticide applications until after the spell.",
                action_hi="Khet ki nikasi naliyon ko saaf rakhein. Barish ke baad tak khaad aur keetnashak chhidkav taal dein.",
            )

    # 4. Favorable onset window
    if onset_p >= 0.55 and break_p < 0.45:
        if stage in ("planning", "sowing"):
            return Advisory(
                severity="info",
                title_en=f"Favorable sowing window for {crop}",
                title_hi=f"{crop} ke liye anukool buwai samay",
                message_en=(
                    f"{onset_p*100:.0f}% probability of stable monsoon onset in the next 7 days "
                    "with low dry-spell risk. Conditions are favorable for sowing."
                ),
                message_hi=(
                    f"Agle 7 dino mein sthir monsoon aagman ki {onset_p*100:.0f}% sambhavna hai "
                    "aur break ka khatra kam hai. Buwai ke liye sthiti anukool hai."
                ),
                action_en="Proceed with field preparation and sowing. Maintain seed treatment with recommended bio-fungicide.",
                action_hi="Khet ki taiyari aur buwai shuru karein. Beej ko anushansit phaphoondnashak se upcharit zaroor karein.",
            )
        else:
            return Advisory(
                severity="info",
                title_en=f"Favorable rainfall outlook for {crop} ({stage})",
                title_hi=f"{crop} ({stage}) ke liye anukool barish",
                message_en=(
                    f"Consistent rainfall expected ({onset_p*100:.0f}% probability) supporting healthy {stage} growth."
                ),
                message_hi=(
                    f"Niyamit barish ({onset_p*100:.0f}% sambhavna) se {stage} vikas mein madad milegi."
                ),
                action_en="Continue standard nutrient and weed management according to package of practices.",
                action_hi="Fasal calendar ke anusar poshak tatva aur kharpatwar prabandhan jaari rakhein.",
            )

    return Advisory(
        severity="info",
        title_en=f"Routine outlook for {crop} ({stage})",
        title_hi=f"{crop} ({stage}) ke liye samanya poorvanuman",
        message_en="No significant break, heavy-rain, or onset anomaly detected for your area this week.",
        message_hi="Is hafte aapke ilake mein koi bada break, bhaari barish, ya aagman badlav nahi dekha gaya.",
        action_en="Continue routine field monitoring and standard crop calendar practices.",
        action_hi="Niyamit khet nigrani aur standard fasal calendar ka palan jaari rakhein.",
    )
