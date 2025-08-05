import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/MaterialIcons";

import { useRouter } from "expo-router";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";
import DropDownPicker from "react-native-dropdown-picker";
import styles from "./Style";

interface PickerItem {
  label: string;
  value: string;
}

interface ExpiryItem {
  date: string;
  qty: number;
}

interface AndroidPickerProps {
  label: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
  enabled?: boolean;
}

const AndroidPicker: React.FC<AndroidPickerProps> = ({
  label,
  selectedValue,
  onValueChange,
  items,
  enabled = true, // Set default to true
}) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.dropdown}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={(itemValue: string) => onValueChange(itemValue)}
        mode="dialog"
        prompt={label}
        enabled={enabled} // Pass it to Picker
      >
        {items.map((item) => (
          <Picker.Item
            key={item.value}
            label={item.label}
            value={item.value}
            color="#000000"
          />
        ))}
      </Picker>
    </View>
  </>
);

const LabeledInput = ({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  style, // ✅ receive style here
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
  style?: ViewStyle; // ❌ remove TextStyle here
}) => (
  <View style={style}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      editable={editable}
    />
  </View>
);

type AvailabilityType = "Carried" | "Not Carried" | "Delisted";
type VersionType = "SKU";

type GroupedInventory = {
  email: String;
  date: string;
  merchandiser: string;
  outlet: string;
  weeksCovered: string;
  month: string;
  week: string;
  versions: {
    [key in VersionType]: {
      [key in AvailabilityType]: any[]; // You can type this more strictly later
    };
  };
};

export interface OfflineInventoryItem {
  data: GroupedInventory;
  previousWeekId?: string;
  isOffline?: boolean; // add this optional field if you want
}

const InventoryProcess = () => {
  const [email, setEmail] = useState("");
  const [date] = useState(moment().format("YYYY-MM-DD"));
  const [merchandiser, setMerchandiser] = useState("");
  const [outlet, setOutlet] = useState("");
  const [weeksCovered, setWeeksCovered] = useState("");
  const [month, setMonth] = useState("");
  const [week, setWeek] = useState("");
  const [sku, setSku] = useState("");
  const [selectedSkuCode, setSelectedSkuCode] = useState("");
  const [availability, setAvailability] = useState<{
    [version: string]: { [skuKey: string]: string };
  }>({});

  const [showPicker, setShowPicker] = useState(false);
  const [currentSkuKey, setCurrentSkuKey] = useState<string | null>(null);
  const [selectedExpiryIndex, setSelectedExpiryIndex] = useState<number | null>(
    null
  );
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [outletOptions, setOutletOptions] = useState([
    { label: "Select Branch", value: "" },
  ]);
  const [weekOptions, setWeekOptions] = useState<PickerItem[]>([
    { label: "Select Week", value: "" },
  ]);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [skuValues, setSkuValues] = useState<any>({
    beginning: {},
    delivery: {},
    ending: {},
    expiry: {}, // Add expiry field here
    quantity: {}, // Add quantity field here
    offtake: {},
    inventoryDays: {},
  });
  const router = useRouter();

  const showDatePicker = (skuKey: string, index: number) => {
    setCurrentSkuKey(skuKey);
    setSelectedExpiryIndex(index);
    setShowPicker(true);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (
      selectedDate &&
      currentSkuKey !== null &&
      selectedExpiryIndex !== null
    ) {
      const formattedDate = formatDate(selectedDate); // You should already have this
      handleExpiryChange(currentSkuKey, selectedExpiryIndex, formattedDate);
    }
  };

  const handleExpiryChange = (
    skuKey: string,
    index: number,
    formattedDate: string
  ) => {
    setSkuValues((prev: any) => {
      const current = [...(prev.expiry?.[version]?.[skuKey] || [])];
      current[index] = { ...current[index], date: formattedDate };

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: current,
          },
        },
      };
    });
  };

  const handleExpiryQtyChange = (
    skuKey: string,
    index: number,
    qty: string
  ) => {
    setSkuValues((prev: any) => {
      const current = [...(prev.expiry?.[version]?.[skuKey] || [])];
      current[index] = {
        ...current[index],
        qty: qty === "" ? "" : Number(qty), // 👈 fix is here
      };

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: current,
          },
        },
      };
    });
  };

  const addExpiryEntry = (skuKey: string) => {
    setSkuValues((prev: any) => {
      const current = [...(prev.expiry?.[version]?.[skuKey] || [])];
      current.push({ date: "", qty: "" });

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: current,
          },
        },
      };
    });
  };

  const deleteExpiryEntry = (skuKey: string, index: number) => {
    setSkuValues((prev: any) => {
      const current = [...(prev.expiry?.[version]?.[skuKey] || [])];
      current.splice(index, 1); // Remove the selected entry

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: current,
          },
        },
      };
    });
  };

  // Helper function to format the date as "16NOV24"
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
  };

  const handleQuantityChange = (skuKey: string, qty: string) => {
    setSkuValues((prev: any) => ({
      ...prev,
      quantity: {
        ...prev.quantity,
        [version]: {
          ...(prev.quantity?.[version] || {}),
          [skuKey]: qty,
        },
      },
    }));
  };

  useEffect(() => {
    if (!version) return; // avoid calculating if version not selected

    const newOfftake: any = {};
    const newInventoryDays: any = {};

    filteredSkuOptions.forEach((skuItem) => {
      const beginning = parseFloat(
        skuValues.beginning?.[version]?.[skuItem.value] || "0"
      );
      const delivery = parseFloat(
        skuValues.delivery?.[version]?.[skuItem.value] || "0"
      );
      const ending = parseFloat(
        skuValues.ending?.[version]?.[skuItem.value] || "0"
      );

      const calculatedOfftake = beginning + delivery - ending;
      newOfftake[skuItem.value] = calculatedOfftake.toFixed(2);

      if (calculatedOfftake === 0) {
        newInventoryDays[skuItem.value] = "";
      } else {
        const inventoryDaysLevel = ending / (calculatedOfftake / 7);
        newInventoryDays[skuItem.value] = inventoryDaysLevel.toFixed(2);
      }
    });

    setSkuValues((prev: any) => ({
      ...prev,
      offtake: {
        ...prev.offtake,
        [version]: newOfftake,
      },
      inventoryDays: {
        ...prev.inventoryDays,
        [version]: newInventoryDays,
      },
    }));
  }, [skuValues.beginning, skuValues.delivery, skuValues.ending, version]);

  useEffect(() => {
    const today = moment();

    // Always get Friday of the current ISO week (Monday–Sunday)
    const thisFriday = today.clone().isoWeekday(5);

    // Monday of that same ISO week
    const weekStart = thisFriday.clone().isoWeekday(1); // Monday
    const weekEnd = thisFriday.clone(); // Friday

    const label = `${weekStart.format("MMMDD")}-${weekEnd.format("MMMDD")}`;

    setWeekOptions([
      { label: "Select Week", value: "" },
      { label, value: label },
    ]);
  }, []);

  // When they pick it, calculate month & week off that Friday
  const handleWeeksCoveredChange = (value: string) => {
    setWeeksCovered(value);

    if (value) {
      const [start, end] = value.split("-");
      const friDate = moment(end, "MMMDD").year(moment().year()); // assign current year
      const monthName = friDate.format("MMMM");

      // Find the first Monday *on or after* Jan 1
      const jan1 = moment().startOf("year");
      const firstMonday =
        jan1.isoWeekday() === 1
          ? jan1
          : jan1.clone().add(8 - jan1.isoWeekday(), "days");

      // Fixed week number calculation - adding 1 to correct the offset
      const weekNum = Math.floor(friDate.diff(firstMonday, "days") / 7) + 2;

      setMonth(monthName);
      setWeek(`Week ${weekNum}`);
    } else {
      setMonth("");
      setWeek("");
    }
  };

  useEffect(() => {
    if (weekOptions.length > 1) {
      const autoSelectedWeek = weekOptions[1].value; // index 1 because index 0 is "Select Week"
      setWeeksCovered(autoSelectedWeek);
      handleWeeksCoveredChange(autoSelectedWeek);
    }
  }, [weekOptions]);

  useEffect(() => {
    if (version && sku) {
      const code =
        skuData[version].find((item) => item.value === sku)?.code || "";
      setSelectedSkuCode(code);
    }
  }, [version, sku]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setMerchandiser(`${user.firstName} ${user.lastName}`);
      }
    };

    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchUserEmail = async () => {
      const userEmail = await AsyncStorage.getItem("user");
      if (userEmail) {
        const Emailuser = JSON.parse(userEmail);
        setEmail(`${Emailuser.email}`);
      }
    };

    fetchUserEmail();
  }, []);

  useEffect(() => {
    if (!version) return;

    // If this version has never been initialized, set all SKUs to “Carried”
    setAvailability((prev) => {
      if (prev[version]) return prev; // already done

      const defaults = (skuData[version] || []).reduce<Record<string, string>>(
        (acc, sku) => {
          acc[sku.value] = "Carried";
          return acc;
        },
        {}
      );

      return {
        ...prev,
        [version]: defaults,
      };
    });
  }, [version]);

  useEffect(() => {
    const loadOutlets = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.error("No auth token found");
          return;
        }

        const response = await fetch(
          "https://api-brewflow.bmphrc.com/user/outlets",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const outlets = await response.json();
          const options = outlets.map((outlet: string) => ({
            label: outlet,
            value: outlet,
          }));

          setOutletOptions([{ label: "Select Branch", value: "" }, ...options]);
        } else {
          console.error("Failed to fetch outlets:", await response.text());
        }
      } catch (error) {
        console.error("Failed to load outlets", error);
      }
    };

    loadOutlets();
  }, []);

  const skuData: {
    [version: string]: { label: string; value: string; code: string }[];
  } = {
    SKU: [
      {
        label: "LIVE IT UP LAGER",
        value: "LIVE IT UP LAGER",
        code: "4 806534 610144",
      },
      {
        label: "HIGH HIVE HONEY ALE",
        value: "HIGH HIVE HONEY ALE",
        code: "4 806534 610168",
      },
      {
        label: "PAINT ME PURPLE UBE LAGER",
        value: "PAINT ME PURPLE UBE LAGER",
        code: "4 806534 610410",
      },
      {
        label: "MANGO NATION HAZY IPA",
        value: "MANGO NATION HAZY IPA",
        code: "4 806534 610175",
      },
      {
        label: "GREEN LAVA DOUBLE IPA",
        value: "GREEN LAVA DOUBLE IPA",
        code: "4 806534 610151",
      },
      {
        label: "NUTTY & NICE CHOCO NUT STOUT",
        value: "NUTTY & NICE CHOCO NUT STOUT",
        code: "4 806534 610502",
      },
      // {
      //   label: "SUNDAZE GOLDEN ALE (S&R)",
      //   value: "SUNDAZE GOLDEN ALE (S&R)",
      //   code: "4 806534 610403",
      // },
    ],
  };

  // Count how many SKUs are considered completed
  const getCompletedSkuCount = () => {
    let completedCount = 0;

    ["SKU"].forEach((v) => {
      const versionSkus = skuData[v] || [];

      versionSkus.forEach((skuItem) => {
        const key = skuItem.value;
        const avail = availability[v]?.[key];

        if (avail === "Not Carried" || avail === "Delisted") {
          // Unavailable skus count as completed
          completedCount++;
        } else {
          // Otherwise only if all three fields are filled
          const b = skuValues.beginning?.[v]?.[key] || "";
          const d = skuValues.delivery?.[v]?.[key] || "";
          const e = skuValues.ending?.[v]?.[key] || "";

          if (b !== "" && d !== "" && e !== "") {
            completedCount++;
          }
        }
      });
    });

    return completedCount;
  };

  // Always the fixed total of all SKUs across SKU, V2, V3
  const getTotalSkuCount = () => {
    return ["SKU"].reduce((sum, v) => sum + (skuData[v]?.length || 0), 0);
  };

  const filteredSkuOptions =
    skuData[version]?.filter((item) => item.value !== "") || [];

  const handleConditionalSubmit = () => {
    const incompleteVersions: string[] = [];

    ["SKU"].forEach((version) => {
      const skuList = skuData[version];
      const isVersionComplete = skuList.every((sku) => {
        const key = sku.value;
        const isNotCarriedOrDelisted =
          availability[version]?.[key] === "Not Carried" ||
          availability[version]?.[key] === "Delisted";

        const hasAllValues =
          skuValues.beginning?.[version]?.[key] &&
          skuValues.delivery?.[version]?.[key] &&
          skuValues.ending?.[version]?.[key];

        return isNotCarriedOrDelisted || hasAllValues;
      });

      if (!isVersionComplete) {
        incompleteVersions.push(version);
      }
    });

    if (incompleteVersions.length > 0) {
      Alert.alert(
        "Incomplete SKUs",
        `Please complete all SKUs in: ${incompleteVersions.join(", ")}`,
        [{ text: "OK" }]
      );
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!merchandiser || !selectedOutlet || !weeksCovered || !month || !week) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    if (!email) {
      console.error("❌ Missing userEmail!");
      Alert.alert("Error", "User email is not set. Please log in again.");
      return;
    }

    setLoading(true);

    const versions: VersionType[] = ["SKU"];

    const groupedInventory: GroupedInventory = {
      email,
      date,
      merchandiser,
      outlet: selectedOutlet,
      weeksCovered,
      month,
      week,
      versions: {
        SKU: { Carried: [], "Not Carried": [], Delisted: [] },
      },
    };

    versions.forEach((v) => {
      const skus = skuData[v]?.filter((item) => item.value !== "") || [];

      skus.forEach((skuItem) => {
        const skuKey = skuItem.value;
        const status = (availability[v]?.[skuKey] ||
          "Carried") as AvailabilityType;

        const commonFields = {
          sku: skuItem.value,
          skuCode: skuItem.code,
        };
        const expiryList = skuValues.expiry?.[v]?.[skuKey] ?? [];
        if (status === "Carried") {
          groupedInventory.versions[v][status].push({
            ...commonFields,
            beginningPCS: Number(skuValues.beginning?.[v]?.[skuKey] || 0),
            deliveryPCS: Number(skuValues.delivery?.[v]?.[skuKey] || 0),
            endingPCS: Number(skuValues.ending?.[v]?.[skuKey] || 0),
            offtake: Number(skuValues.offtake?.[v]?.[skuKey] || 0),
            inventoryDays: Number(skuValues.inventoryDays?.[v]?.[skuKey] || 0),
            expiryMonths: expiryList
              .map((e: ExpiryItem) => e.date)
              .filter(Boolean),
            expiryQty: expiryList.map((e: ExpiryItem) => Number(e.qty) || 0),
          });
        } else {
          groupedInventory.versions[v][status].push(commonFields);
        }
      });
    });

    // Use previousWeekId from state or props if available

    // const saveOffline = async () => {
    //   try {
    //     const existing = await AsyncStorage.getItem("offlineInventories");
    //     const offlineList: OfflineInventoryItem[] = existing
    //       ? JSON.parse(existing)
    //       : [];

    //     offlineList.push({
    //       data: groupedInventory,
    //     });

    //     await AsyncStorage.setItem(
    //       "offlineInventories",
    //       JSON.stringify(offlineList)
    //     );

    //     Alert.alert(
    //       "Saved Offline",
    //       "No internet. Inventory will sync automatically later."
    //     );
    //     router.replace("/HomeScreen");
    //   } catch (err) {
    //     console.error("Failed to save locally:", err);
    //     Alert.alert("Error", "Couldn't save inventory offline.");
    //   }
    // };

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        //await saveOffline();
        return;
      }

      const res = await fetch(
        "https://api-brewflow.bmphrc.com/inventory/grouped",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupedInventory),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await res.json();
        console.log("✅ Grouped inventory saved:", data);
        router.replace("/HomeScreen");
      } else {
        console.warn("Received non-JSON response:", await res.text());
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Network")) {
        //await saveOffline();
      } else {
        console.error("❌ Error saving whole inventory:", err);
        Alert.alert("Error", "Failed to save inventory.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <View style={styles.appBarInventoryprocess}>
          <Text style={styles.appBarTitleInventoryprocess}>
            INVENTORY PROCESS
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.containerinventory,
            { paddingBottom: 50, paddingTop: 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LabeledInput
            label="Date"
            value={date}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Merchandiser Name"
            value={merchandiser}
            onChangeText={setMerchandiser}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <DropDownPicker
            open={open}
            value={selectedOutlet}
            items={outletOptions}
            setOpen={setOpen}
            setValue={setSelectedOutlet}
            setItems={setOutletOptions}
            searchable
            placeholder="Select Branch"
            // style={{ width: 407 }}
            // dropDownContainerStyle={{ width: 407 }}
            listMode="SCROLLVIEW"
          />

          <AndroidPicker
            label="Weeks Covered"
            selectedValue={weeksCovered}
            onValueChange={handleWeeksCoveredChange}
            items={weekOptions}
            enabled={false} // Use this instead of editable
          />

          <LabeledInput
            label="Month"
            value={month}
            onChangeText={setMonth}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Week"
            value={week}
            onChangeText={setWeek}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <Text style={styles.label}>Select Version</Text>
          <View style={styles.buttonRow}>
            {["SKU"].map((v) => {
              const versionSkus = skuData[v] || [];
              let completedSkuCount = 0;
              const totalSkuCount = versionSkus.length;

              versionSkus.forEach((skuItem) => {
                const key = skuItem.value;
                const avail = availability[v]?.[key];

                // If it’s not carried or delisted, count as done
                if (avail === "Not Carried" || avail === "Delisted") {
                  completedSkuCount++;
                } else {
                  // Otherwise require all three fields
                  const b = skuValues.beginning?.[v]?.[key] || "";
                  const d = skuValues.delivery?.[v]?.[key] || "";
                  const e = skuValues.ending?.[v]?.[key] || "";

                  if (b !== "" && d !== "" && e !== "") {
                    completedSkuCount++;
                  }
                }
              });

              return (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.versionBtn,
                    version === v && styles.selectedButton,
                  ]}
                  onPress={() => {
                    setVersion((prev) => (prev === v ? "" : v));
                    setSku("");
                    setExpandedSection(null);
                  }}
                  disabled={version !== "" && version !== v}
                >
                  <Text style={styles.btnText}>
                    {completedSkuCount}/{totalSkuCount} {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {version !== "" && (
            <>
              {["Beginning", "Delivery", "Ending"].map((section) => {
                const sectionKey = section.toLowerCase();
                const filledCount = filteredSkuOptions.filter((skuItem) => {
                  const skuKey = skuItem.value;
                  const val = skuValues[sectionKey]?.[version]?.[skuKey];

                  const availStatus = availability[version]?.[skuKey];

                  // Count if value is filled or availability is Not Carried / Delisted
                  return (
                    (val !== undefined && val !== "") ||
                    availStatus === "Not Carried" ||
                    availStatus === "Delisted"
                  );
                }).length;

                const totalSkuCount = filteredSkuOptions.length;

                return (
                  <View key={section} style={{ marginVertical: 10 }}>
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() =>
                        setExpandedSection((prev) =>
                          prev === section ? null : section
                        )
                      }
                    >
                      <Text style={styles.expandButtonText}>
                        {expandedSection === section
                          ? `Hide ${section} ${filledCount}/${totalSkuCount}`
                          : `Expand ${section} ${filledCount}/${totalSkuCount}`}
                      </Text>
                    </TouchableOpacity>
                    {expandedSection === section && (
                      <View style={{ marginTop: 10 }}>
                        {filteredSkuOptions.map((skuItem) => {
                          const skuKey = skuItem.value;
                          const isBeginning = sectionKey === "beginning";

                          const availabilityValue =
                            availability[version]?.[skuKey] ??
                            (isBeginning ? "Carried" : "");

                          const isBeginningEditable =
                            isBeginning && availabilityValue === "Carried";
                          const isOtherSectionEditable =
                            !isBeginning &&
                            availability[version]?.[skuKey] === "Carried";
                          const isEditable = isBeginning
                            ? isBeginningEditable
                            : isOtherSectionEditable;

                          return (
                            <TouchableOpacity
                              key={skuKey}
                              activeOpacity={1} // Keep the row visible when touched
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                            >
                              {/* SKU Label */}
                              <ScrollView
                                horizontal
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingRight: 10 }}
                                scrollEnabled={true}
                              >
                                <Text style={styles.skuText} numberOfLines={1}>
                                  {skuItem.label}
                                </Text>
                              </ScrollView>

                              {/* Availability Picker (Beginning only) */}
                              {isBeginning && (
                                <View
                                  style={{
                                    flex: 0.5,
                                    marginHorizontal: 2,
                                    borderWidth: 1,
                                    borderColor: "#ccc",
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    minWidth: 20,
                                  }}
                                >
                                  <Picker
                                    selectedValue={availabilityValue}
                                    enabled={false}
                                    style={{
                                      height: 50,
                                      width: "100%",
                                      backgroundColor: "white",
                                    }}
                                    itemStyle={{
                                      fontSize: 11,
                                    }}
                                    onValueChange={(value) => {
                                      setAvailability((prev) => ({
                                        ...prev,
                                        [version]: {
                                          ...(prev[version] || {}),
                                          [skuKey]: value,
                                        },
                                      }));
                                    }}
                                    mode="dropdown"
                                  >
                                    <Picker.Item
                                      label="Carried"
                                      value="Carried"
                                      style={{ fontSize: 11, color: "black" }}
                                    />
                                  </Picker>
                                  <Icon
                                    name="arrow-drop-down"
                                    size={24}
                                    color="grey"
                                    style={{
                                      position: "absolute",
                                      right: 10,
                                      top: 13,
                                      pointerEvents: "none", // ensures Picker underneath still responds
                                    }}
                                  />
                                </View>
                              )}

                              {/* Quantity Input (editable only if Carried) */}
                              <TextInput
                                style={[
                                  styles.inputBox,
                                  {
                                    width: 52,
                                    height: 40,
                                    marginLeft: isBeginning ? 0 : 6,
                                    textAlign: "center",
                                    backgroundColor:
                                      availabilityValue === "Carried"
                                        ? "#FFFFFF"
                                        : "#f0f0f0", // light blue if carried, gray otherwise
                                    borderColor:
                                      availabilityValue === "Carried"
                                        ? "#2c1c5c"
                                        : "#ccc", // teal if carried
                                    borderWidth: 1,
                                  },
                                ]}
                                keyboardType="numeric"
                                value={
                                  skuValues[sectionKey]?.[version]?.[skuKey] ||
                                  ""
                                }
                                onChangeText={(text) => {
                                  setSkuValues((prev: any) => ({
                                    ...prev,
                                    [sectionKey]: {
                                      ...(prev[sectionKey] || {}),
                                      [version]: {
                                        ...(prev[sectionKey]?.[version] || {}),
                                        [skuKey]: text,
                                      },
                                    },
                                  }));
                                }}
                                editable={isEditable}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "Expiry" ? null : "Expiry"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "Expiry"
                      ? `Hide Expiry`
                      : `Expand Expiry`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "Expiry" && (
                  <View style={{ marginTop: 10 }}>
                    {skuData[version]?.map((skuItem) => {
                      const skuKey = skuItem.value;
                      const availabilityValue =
                        availability[version]?.[skuKey] || "Carried";
                      const isEditable = availabilityValue === "Carried";

                      // Get existing expiryList or initialize with one empty entry
                      const expiryList: { date: string; qty: number }[] =
                        skuValues.expiry?.[version]?.[skuKey]?.length > 0
                          ? skuValues.expiry[version][skuKey]
                          : [{ date: "", qty: "" }];

                      return (
                        <View key={skuKey} style={{ marginBottom: 12 }}>
                          {/* Render all expiry rows */}
                          {expiryList.map((entry, index) => (
                            <View
                              key={`${skuKey}-${index}`}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 10,
                              }}
                            >
                              {/* SKU Label */}
                              <Text style={[styles.skuText, { flex: 2 }]}>
                                {skuItem.label}
                              </Text>

                              {/* Date Picker Button */}
                              <View style={{ flex: 3, marginHorizontal: 8 }}>
                                <Button
                                  title={entry.date || "Select Date"}
                                  onPress={() => showDatePicker(skuKey, index)}
                                  disabled={!isEditable}
                                  color={isEditable ? "#2c1c5c" : "#d3d3d3"}
                                />
                              </View>

                              {/* Quantity Field */}
                              <TextInput
                                placeholder="Qty"
                                placeholderTextColor={"grey"}
                                style={[
                                  styles.inputBox,
                                  { flex: 1.5, height: 40, fontSize: 14 },
                                ]}
                                keyboardType="numeric"
                                value={entry.qty?.toString() || ""}
                                onChangeText={(text) =>
                                  handleExpiryQtyChange(skuKey, index, text)
                                }
                                editable={isEditable}
                              />
                            </View>
                          ))}

                          {/* Single row below all expiry rows */}
                          {isEditable && (
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: 4,
                                paddingHorizontal: 8,
                              }}
                            >
                              {/* + Add Expiry button (left aligned) */}
                              <TouchableOpacity
                                onPress={() => addExpiryEntry(skuKey)}
                              >
                                <Text
                                  style={{ color: "#2c1c5c", fontSize: 14 }}
                                >
                                  + Add Expiry
                                </Text>
                              </TouchableOpacity>

                              {expiryList.length > 1 ? (
                                <TouchableOpacity
                                  onPress={() => {
                                    deleteExpiryEntry(
                                      skuKey,
                                      expiryList.length - 1
                                    );
                                  }}
                                >
                                  <Text style={{ color: "red", fontSize: 18 }}>
                                    ✕
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={{ width: 30 }} />
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Android-only DateTimePicker */}
                    {showPicker && (
                      <DateTimePicker
                        value={new Date()}
                        mode="date"
                        display="calendar"
                        onChange={onDateChange}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Expandable Offtake Section */}
              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "Offtake" ? null : "Offtake"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "Offtake"
                      ? `Hide Offtake`
                      : `Expand Offtake`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "Offtake" && (
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    activeOpacity={1} // Removes the opacity effect when pressed
                    onPress={() => {}} // Empty function
                  >
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Offtake"
                          style={styles.inputBox}
                          editable={false}
                          value={
                            skuValues.offtake?.[version]?.[skuItem.value] || ""
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>

              {/* Expandable Inventory Days Level Section */}
              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "InventoryDaysLevel"
                        ? null
                        : "InventoryDaysLevel"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "InventoryDaysLevel"
                      ? `Hide Inventory Days Level`
                      : `Expand Inventory Days Level`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "InventoryDaysLevel" && (
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    activeOpacity={1}
                    onPress={() => {}}
                  >
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Inventory Days Level"
                          style={styles.inputBox}
                          editable={false}
                          value={
                            skuValues.inventoryDays?.[version]?.[
                              skuItem.value
                            ] || ""
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <View style={[styles.buttonRow, { justifyContent: "space-between" }]}>
            <TouchableOpacity
              style={[styles.submitButton, { flex: 1, marginRight: 5 }]}
              onPress={() => router.replace("/(tabs)/HomeScreen")}
            >
              <Text style={styles.submitButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { flex: 1, marginLeft: 5, opacity: loading ? 0.5 : 1 },
              ]}
              disabled={loading}
              onPress={handleConditionalSubmit}
            >
              <Text style={styles.submitButtonText}>
                {loading
                  ? "Submitting..."
                  : `Submit (${getCompletedSkuCount()}/${getTotalSkuCount()})`}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default InventoryProcess;
